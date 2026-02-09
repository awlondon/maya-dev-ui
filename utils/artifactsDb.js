import crypto from 'node:crypto';

function mapArtifactRow(row) {
  if (!row) {
    return null;
  }
  return {
    artifact_id: row.id,
    owner_user_id: row.owner_user_id,
    visibility: row.visibility,
    created_at: row.created_at,
    updated_at: row.updated_at,
    title: row.title,
    description: row.description || '',
    code: {
      language: row.code_language || 'html',
      content: row.code_content || ''
    },
    screenshot_url: row.screenshot_url || '',
    derived_from: {
      artifact_id: row.forked_from_id || null,
      owner_user_id: row.forked_from_owner_user_id || null,
      version_id: row.forked_from_version_id || null,
      version_label: row.forked_from_version_label || null
    },
    source_session: {
      session_id: row.source_session_id || '',
      credits_used_estimate: Number(row.source_session_credits_estimate || 0) || 0
    },
    current_version_id: row.current_version_id || null,
    versioning: {
      enabled: row.versioning_enabled ?? false,
      chat_history_public: row.chat_history_public ?? false
    },
    stats: {
      forks: Number(row.forks_count || 0),
      imports: Number(row.imports_count || 0),
      likes: Number(row.likes_count || 0),
      comments: Number(row.comments_count || 0)
    }
  };
}

function mapArtifactVersionRow(row) {
  if (!row) {
    return null;
  }
  return {
    version_id: row.id,
    artifact_id: row.artifact_id,
    session_id: row.session_id || '',
    created_at: row.created_at,
    label: row.label || null,
    version_index: Number(row.version_index || 0),
    code: {
      language: row.code_language || 'html',
      content: row.code_content || ''
    },
    code_versions: row.code_versions || null,
    chat: row.chat || { included: false, messages: null },
    stats: {
      turns: row.chat?.messages?.length ?? 0,
      credits_used_estimate: Number(row.credits_used_estimate || 0) || 0
    },
    summary: row.summary || null
  };
}

const ARTIFACT_SELECT = `
  SELECT
    a.id,
    a.owner_user_id,
    a.title,
    a.description,
    a.visibility,
    a.created_at,
    a.updated_at,
    a.forked_from_id,
    a.forked_from_owner_user_id,
    a.forked_from_version_id,
    a.forked_from_version_label,
    a.source_session_id,
    a.source_session_credits_estimate,
    a.current_version_id,
    a.versioning_enabled,
    a.chat_history_public,
    a.forks_count,
    a.imports_count,
    a.likes_count,
    a.comments_count,
    m.screenshot_url,
    m.thumb_url,
    v.code_language,
    v.code_content
  FROM artifacts a
  LEFT JOIN artifact_media m ON m.artifact_id = a.id
  LEFT JOIN artifact_versions v ON v.id = a.current_version_id
`;

async function withTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function fetchProfileByUserId(pool, userId) {
  const { rows } = await pool.query(
    `SELECT * FROM profiles WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

export async function fetchProfileByHandle(pool, handle) {
  const { rows } = await pool.query(
    `SELECT * FROM profiles WHERE handle = $1`,
    [handle]
  );
  return rows[0] || null;
}

export async function upsertProfile(pool, profile) {
  const handleCheck = await pool.query(
    'SELECT user_id FROM profiles WHERE handle = $1',
    [profile.handle]
  );
  const existingHandle = handleCheck.rows[0];
  if (existingHandle && existingHandle.user_id !== profile.user_id) {
    const error = new Error('Handle is already taken');
    error.code = 'HANDLE_TAKEN';
    throw error;
  }
  const { rows } = await pool.query(
    `INSERT INTO profiles (
      user_id,
      handle,
      display_name,
      bio,
      avatar_url,
      age,
      gender,
      city,
      country,
      created_at,
      updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (user_id) DO UPDATE SET
      handle = EXCLUDED.handle,
      display_name = EXCLUDED.display_name,
      bio = EXCLUDED.bio,
      avatar_url = EXCLUDED.avatar_url,
      age = EXCLUDED.age,
      gender = EXCLUDED.gender,
      city = EXCLUDED.city,
      country = EXCLUDED.country,
      updated_at = EXCLUDED.updated_at
    RETURNING *`,
    [
      profile.user_id,
      profile.handle,
      profile.display_name,
      profile.bio,
      profile.avatar_url,
      profile.age,
      profile.gender,
      profile.city,
      profile.country,
      profile.created_at,
      profile.updated_at
    ]
  );
  return rows[0];
}

export async function fetchProfileStats(pool, userId) {
  const { rows } = await pool.query(
    `SELECT
      COUNT(*) FILTER (WHERE visibility = 'public') AS public_artifacts,
      COALESCE(SUM(likes_count), 0) AS total_likes,
      COALESCE(SUM(comments_count), 0) AS total_comments
    FROM artifacts
    WHERE owner_user_id = $1`,
    [userId]
  );
  const forks = await pool.query(
    `SELECT COUNT(*) AS forks_received
     FROM artifacts
     WHERE forked_from_owner_user_id = $1`,
    [userId]
  );
  return {
    public_artifacts: Number(rows[0]?.public_artifacts || 0),
    total_likes: Number(rows[0]?.total_likes || 0),
    total_comments: Number(rows[0]?.total_comments || 0),
    forks_received: Number(forks.rows[0]?.forks_received || 0)
  };
}

export async function fetchArtifactById(pool, artifactId) {
  const { rows } = await pool.query(`${ARTIFACT_SELECT} WHERE a.id = $1`, [artifactId]);
  return mapArtifactRow(rows[0]);
}

export async function fetchArtifactsByOwner(pool, ownerUserId) {
  const { rows } = await pool.query(
    `${ARTIFACT_SELECT} WHERE a.owner_user_id = $1`,
    [ownerUserId]
  );
  return rows.map(mapArtifactRow);
}

export async function fetchPublicArtifacts(pool) {
  const { rows } = await pool.query(
    `${ARTIFACT_SELECT} WHERE a.visibility = 'public'`,
    []
  );
  return rows.map(mapArtifactRow);
}

export async function createArtifact(pool, { artifact, version, screenshotUrl }) {
  return withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO artifacts (
        id,
        owner_user_id,
        title,
        description,
        visibility,
        created_at,
        updated_at,
        forked_from_id,
        forked_from_owner_user_id,
        forked_from_version_id,
        forked_from_version_label,
        source_session_id,
        source_session_credits_estimate,
        current_version_id,
        versioning_enabled,
        chat_history_public,
        forks_count,
        imports_count,
        likes_count,
        comments_count
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        artifact.artifact_id,
        artifact.owner_user_id,
        artifact.title,
        artifact.description,
        artifact.visibility,
        artifact.created_at,
        artifact.updated_at,
        artifact.derived_from?.artifact_id || null,
        artifact.derived_from?.owner_user_id || null,
        artifact.derived_from?.version_id || null,
        artifact.derived_from?.version_label || null,
        artifact.source_session?.session_id || null,
        artifact.source_session?.credits_used_estimate || 0,
        null,
        artifact.versioning?.enabled || false,
        artifact.versioning?.chat_history_public || false,
        artifact.stats?.forks || 0,
        artifact.stats?.imports || 0,
        artifact.stats?.likes || 0,
        artifact.stats?.comments || 0
      ]
    );

    await client.query(
      `INSERT INTO artifact_versions (
        id,
        artifact_id,
        version_index,
        code_blob_ref,
        code_language,
        code_content,
        code_versions,
        chat,
        session_id,
        credits_used_estimate,
        created_at,
        summary,
        label
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        version.version_id,
        artifact.artifact_id,
        1,
        `db:${version.version_id}`,
        version.code?.language || 'html',
        version.code?.content || '',
        version.code_versions || null,
        version.chat || null,
        version.session_id || null,
        version.stats?.credits_used_estimate || 0,
        version.created_at,
        version.summary || null,
        version.label || null
      ]
    );

    await client.query(
      'UPDATE artifacts SET current_version_id = $1 WHERE id = $2',
      [version.version_id, artifact.artifact_id]
    );

    if (screenshotUrl) {
      await client.query(
        `INSERT INTO artifact_media (artifact_id, screenshot_url, updated_at)
         VALUES ($1,$2,now())
         ON CONFLICT (artifact_id) DO UPDATE
         SET screenshot_url = EXCLUDED.screenshot_url,
             updated_at = EXCLUDED.updated_at`,
        [artifact.artifact_id, screenshotUrl]
      );
    }

    const { rows } = await client.query(`${ARTIFACT_SELECT} WHERE a.id = $1`, [artifact.artifact_id]);
    return mapArtifactRow(rows[0]);
  });
}

export async function createArtifactVersion(pool, {
  artifactId,
  version,
  screenshotUrl,
  updatedAt,
  updateTitle,
  updateDescription
}) {
  return withTransaction(pool, async (client) => {
    const { rows: indexRows } = await client.query(
      `SELECT COALESCE(MAX(version_index), 0) + 1 AS next_index
       FROM artifact_versions
       WHERE artifact_id = $1`,
      [artifactId]
    );
    const versionIndex = Number(indexRows[0]?.next_index || 1);

    await client.query(
      `INSERT INTO artifact_versions (
        id,
        artifact_id,
        version_index,
        code_blob_ref,
        code_language,
        code_content,
        code_versions,
        chat,
        session_id,
        credits_used_estimate,
        created_at,
        summary,
        label
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        version.version_id,
        artifactId,
        versionIndex,
        `db:${version.version_id}`,
        version.code?.language || 'html',
        version.code?.content || '',
        version.code_versions || null,
        version.chat || null,
        version.session_id || null,
        version.stats?.credits_used_estimate || 0,
        version.created_at,
        version.summary || null,
        version.label || null
      ]
    );

    if (updateTitle !== null && updateTitle !== undefined) {
      await client.query(
        `UPDATE artifacts
         SET current_version_id = $1,
             updated_at = $2,
             title = $3,
             description = $4
         WHERE id = $5`,
        [version.version_id, updatedAt, updateTitle, updateDescription, artifactId]
      );
    } else {
      await client.query(
        `UPDATE artifacts
         SET current_version_id = $1,
             updated_at = $2
         WHERE id = $3`,
        [version.version_id, updatedAt, artifactId]
      );
    }

    if (screenshotUrl) {
      await client.query(
        `INSERT INTO artifact_media (artifact_id, screenshot_url, updated_at)
         VALUES ($1,$2,now())
         ON CONFLICT (artifact_id) DO UPDATE
         SET screenshot_url = EXCLUDED.screenshot_url,
             updated_at = EXCLUDED.updated_at`,
        [artifactId, screenshotUrl]
      );
    }

    const { rows } = await client.query(`${ARTIFACT_SELECT} WHERE a.id = $1`, [artifactId]);
    return { artifact: mapArtifactRow(rows[0]), version_index: versionIndex };
  });
}

export async function fetchArtifactVersions(pool, artifactId) {
  const { rows } = await pool.query(
    `SELECT * FROM artifact_versions
     WHERE artifact_id = $1
     ORDER BY created_at ASC`,
    [artifactId]
  );
  return rows.map(mapArtifactVersionRow);
}

export async function fetchArtifactVersionById(pool, artifactId, versionId) {
  const { rows } = await pool.query(
    `SELECT * FROM artifact_versions
     WHERE artifact_id = $1 AND id = $2`,
    [artifactId, versionId]
  );
  return mapArtifactVersionRow(rows[0]);
}

export async function updateArtifactPublishSettings(pool, artifactId, enabled, chatHistoryPublic) {
  await pool.query(
    `UPDATE artifacts
     SET versioning_enabled = $2,
         chat_history_public = $3,
         updated_at = now()
     WHERE id = $1`,
    [artifactId, enabled, chatHistoryPublic]
  );
  return fetchArtifactById(pool, artifactId);
}

export async function updateArtifactVisibility(pool, artifactId, visibility) {
  await pool.query(
    `UPDATE artifacts
     SET visibility = $2,
         updated_at = now()
     WHERE id = $1`,
    [artifactId, visibility]
  );
  return fetchArtifactById(pool, artifactId);
}

export async function updateArtifactDetails(pool, artifactId, title, description) {
  await pool.query(
    `UPDATE artifacts
     SET title = $2,
         description = $3,
         updated_at = now()
     WHERE id = $1`,
    [artifactId, title, description]
  );
  return fetchArtifactById(pool, artifactId);
}

export async function deleteArtifactById(pool, artifactId) {
  await pool.query('DELETE FROM artifacts WHERE id = $1', [artifactId]);
}

export async function createArtifactFork(pool, {
  newArtifactId,
  ownerUserId,
  sourceArtifactId,
  requestedVersionId,
  sessionId,
  creditsUsedEstimate
}) {
  return withTransaction(pool, async (client) => {
    const { rows: artifactRows } = await client.query(
      `${ARTIFACT_SELECT} WHERE a.id = $1`,
      [sourceArtifactId]
    );
    const source = mapArtifactRow(artifactRows[0]);
    if (!source) {
      return null;
    }
    const versions = await client.query(
      `SELECT * FROM artifact_versions
       WHERE artifact_id = $1
       ORDER BY created_at ASC`,
      [sourceArtifactId]
    );
    const versionRows = versions.rows.map(mapArtifactVersionRow);
    const resolvedVersion = versionRows.find((version) => version.version_id === requestedVersionId)
      || versionRows.find((version) => version.version_id === source.current_version_id)
      || versionRows[versionRows.length - 1];
    const versionNumber = resolvedVersion
      ? versionRows.findIndex((version) => version.version_id === resolvedVersion.version_id) + 1
      : null;

    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO artifacts (
        id,
        owner_user_id,
        title,
        description,
        visibility,
        created_at,
        updated_at,
        forked_from_id,
        forked_from_owner_user_id,
        forked_from_version_id,
        forked_from_version_label,
        source_session_id,
        source_session_credits_estimate,
        current_version_id,
        versioning_enabled,
        chat_history_public,
        forks_count,
        imports_count,
        likes_count,
        comments_count
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        newArtifactId,
        ownerUserId,
        `Fork of ${source.title || 'artifact'}`,
        source.description || '',
        'private',
        now,
        now,
        source.artifact_id,
        source.owner_user_id,
        resolvedVersion?.version_id || source.current_version_id || null,
        versionNumber ? `v${versionNumber}` : null,
        sessionId || null,
        creditsUsedEstimate || 0,
        null,
        false,
        false,
        0,
        0,
        0,
        0
      ]
    );

    const forkVersionId = crypto.randomUUID();
    await client.query(
      `INSERT INTO artifact_versions (
        id,
        artifact_id,
        version_index,
        code_blob_ref,
        code_language,
        code_content,
        code_versions,
        chat,
        session_id,
        credits_used_estimate,
        created_at,
        summary,
        label
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        forkVersionId,
        newArtifactId,
        1,
        `db:${forkVersionId}`,
        resolvedVersion?.code?.language || 'html',
        resolvedVersion?.code?.content || '',
        resolvedVersion?.code_versions || null,
        null,
        sessionId || null,
        creditsUsedEstimate || 0,
        now,
        null,
        null
      ]
    );

    await client.query(
      'UPDATE artifacts SET current_version_id = $1 WHERE id = $2',
      [forkVersionId, newArtifactId]
    );

    if (source.screenshot_url) {
      await client.query(
        `INSERT INTO artifact_media (artifact_id, screenshot_url, updated_at)
         VALUES ($1,$2,now())
         ON CONFLICT (artifact_id) DO UPDATE
         SET screenshot_url = EXCLUDED.screenshot_url,
             updated_at = EXCLUDED.updated_at`,
        [newArtifactId, source.screenshot_url]
      );
    }

    await client.query(
      `UPDATE artifacts
       SET forks_count = COALESCE(forks_count, 0) + 1,
           imports_count = COALESCE(imports_count, 0) + 1,
           updated_at = now()
       WHERE id = $1`,
      [sourceArtifactId]
    );

    const { rows } = await client.query(`${ARTIFACT_SELECT} WHERE a.id = $1`, [newArtifactId]);
    return mapArtifactRow(rows[0]);
  });
}

export { mapArtifactRow, mapArtifactVersionRow };
