'use server'

import { Prisma } from '@prisma/client'
import { db } from '~/server/lib/db'

export async function fetchConfigsByKeys(keys: string[]) {
  return await db.configs.findMany({
    where: {
      config_key: {
        in: keys
      }
    },
    select: {
      id: true,
      config_key: true,
      config_value: true,
      detail: true
    }
  });
}

export async function fetchAlbumsList() {
  const albums = await db.albums.findMany({
    where: {
      del: 0
    },
    orderBy: [
      {
        sort: 'desc',
      },
      {
        createdAt: 'desc',
      },
      {
        updatedAt: 'desc'
      }
    ]
  });
  
  // Map random_show to randomShow
  return albums.map(album => ({
    ...album,
    randomShow: album.random_show
  }));
}

export async function fetchServerImagesListByAlbum(pageNum: number, album: string) {
  if (album === 'all') {
    album = ''
  }
  if (pageNum < 1) {
    pageNum = 1
  }
  if (album && album !== '') {
    return await db.$queryRaw`
      SELECT 
          image.*,
          albums.name AS album_name,
          albums.id AS album_value,
          COALESCE((
              SELECT json_agg(copyright.id)
              FROM "public"."copyrights" AS copyright
              INNER JOIN "public"."images_copyright_relation" AS icrelation
                  ON copyright.id = icrelation."copyrightId"
              INNER JOIN "public"."images" AS image_child
                  ON icrelation."imageId" = image_child."id"
              WHERE copyright.del = 0
              AND image_child.del = 0
              AND image.id = image_child.id
          ),
          '[]'::json) AS copyrights
      FROM 
          "public"."images" AS image
      INNER JOIN "public"."images_albums_relation" AS relation
          ON image.id = relation."imageId"
      INNER JOIN "public"."albums" AS albums
          ON relation.album_value = albums.album_value
      WHERE
          image.del = 0
      AND
          albums.del = 0
      AND
          albums.album_value = ${album}
      ORDER BY image.sort DESC, image.created_at DESC, image.updated_at DESC
      LIMIT 8 OFFSET ${(pageNum - 1) * 8}
    `;
  }
  return await db.$queryRaw`
    SELECT 
        image.*,
        albums.name AS album_name,
        albums.id AS album_value,
        COALESCE((
            SELECT json_agg(copyright.id)  -- 直接聚合 copyright.id，而不是整行
            FROM "public"."copyrights" AS copyright
            INNER JOIN "public"."images_copyright_relation" AS icrelation
                ON copyright.id = icrelation."copyrightId"
            INNER JOIN "public"."images" AS image_child
                ON icrelation."imageId" = image_child."id"
            WHERE copyright.del = 0
            AND image_child.del = 0
            AND image.id = image_child.id
        ),
        '[]'::json) AS copyrights
    FROM 
        "public"."images" AS image
    LEFT JOIN "public"."images_albums_relation" AS relation
        ON image.id = relation."imageId"
    LEFT JOIN "public"."albums" AS albums
        ON relation.album_value = albums.album_value
    WHERE 
        image.del = 0
    ORDER BY image.sort DESC, image.created_at DESC, image.updated_at DESC 
    LIMIT 8 OFFSET ${(pageNum - 1) * 8}
  `;
}

export async function fetchServerImagesPageTotalByAlbum(album: string) {
  if (album === 'all') {
    album = ''
  }
  if (album && album !== '') {
    const pageTotal = await db.$queryRaw`
      SELECT COALESCE(COUNT(1),0) AS total
      FROM (
        SELECT DISTINCT ON (image.id)
            image.id 
        FROM 
            "public"."images" AS image
        INNER JOIN "public"."images_albums_relation" AS relation
            ON image.id = relation."imageId"
        INNER JOIN "public"."albums" AS albums
            ON relation.album_value = albums.album_value
        WHERE 
            image.del = 0
        AND
            albums.del = 0
        AND
            albums.album_value = ${album}
      ) AS unique_images;
    `
    // @ts-ignore
    return Number(pageTotal[0].total) ?? 0
  }
  const pageTotal = await db.$queryRaw`
    SELECT COALESCE(COUNT(1),0) AS total
    FROM (
      SELECT DISTINCT ON (image.id)
          image.id
      FROM
          "public"."images" AS image
      LEFT JOIN "public"."images_albums_relation" AS relation
          ON image.id = relation."imageId"
      LEFT JOIN "public"."albums" AS albums
          ON relation.album_value = albums.album_value
      WHERE
          image.del = 0
     ) AS unique_images;
  `
  // @ts-ignore
  // return Number(pageTotal[0].total) > 0 ? Math.ceil(Number(pageTotal[0].total) / 8) : 0
  return Number(pageTotal[0].total) ?? 0
}

const ALBUM_IMAGE_SORTING_ORDER = [
  null,
  'image.created_at DESC, image.updated_at DESC',
  'COALESCE(TO_TIMESTAMP(image.exif->>\'data_time\', \'YYYY:MM:DD HH24:MI:SS\'), \'1970-01-01 00:00:00\') DESC, image.created_at DESC, image.updated_at DESC',
  'image.created_at ASC, image.updated_at ASC',
  'COALESCE(TO_TIMESTAMP(image.exif->>\'data_time\', \'YYYY:MM:DD HH24:MI:SS\'), \'1970-01-01 00:00:00\') ASC, image.created_at ASC, image.updated_at ASC',
]

export async function fetchClientImagesListByAlbum(pageNum: number, album: string) {
  if (pageNum < 1) {
    pageNum = 1
  }
  const customIndexStyle = await db.configs.findUnique({
    where: {
      config_key: 'custom_index_style',
    },
    select: {
      id: true,
      config_key: true,
      config_value: true,
      detail: true
    }
  });
  if (customIndexStyle?.config_value === '1' && album === '/') {
    return await db.$queryRaw`
    SELECT 
        image.*,
        (
            SELECT json_agg(row_to_json(t))
            FROM (
                SELECT copyright.*
                FROM "public"."copyrights" AS copyright
                INNER JOIN "public"."images_copyright_relation" AS icrelation
                    ON copyright.id = icrelation."copyrightId"
                INNER JOIN "public"."images" AS image_child
                    ON icrelation."imageId" = image_child."id"
                WHERE copyright.del = 0
                AND image_child.del = 0
                AND copyright.show = 0
                AND copyright.default = 1
                AND image.id = image_child.id
                UNION
                SELECT copyright.*
                FROM "public"."copyrights" AS copyright
                WHERE copyright.del = 0
                AND copyright.show = 0
                AND copyright.default = 0
            ) t
        ) AS copyrights
    FROM 
        "public"."images" AS image
    WHERE
        image.del = 0
    AND
        image.show = 0
    AND
        image.show_on_mainpage = 0
    ORDER BY image.created_at DESC, image.updated_at DESC
    LIMIT 16 OFFSET ${(pageNum - 1) * 16}
  `;
  }
  const albumData = await db.albums.findFirst({
    where: {
      album_value: album
    }
  })
  let orderBy = Prisma.sql(['image.sort DESC, image.created_at DESC, image.updated_at DESC'])
  if (albumData && albumData.image_sorting && ALBUM_IMAGE_SORTING_ORDER[albumData.image_sorting]) {
    orderBy = Prisma.sql([`image.sort DESC, ${ALBUM_IMAGE_SORTING_ORDER[albumData.image_sorting]}`])
  }
  return await db.$queryRaw`
    SELECT 
        image.*,
        albums.name AS album_name,
        albums.id AS album_value,
        albums.allow_download AS album_allow_download,
        albums.license AS album_license,
        albums.image_sorting AS album_image_sorting,
        (
            SELECT json_agg(row_to_json(t))
            FROM (
                SELECT copyright.*
                FROM "public"."copyrights" AS copyright
                INNER JOIN "public"."images_copyright_relation" AS icrelation
                    ON copyright.id = icrelation."copyrightId"
                INNER JOIN "public"."images" AS image_child
                    ON icrelation."imageId" = image_child."id"
                WHERE copyright.del = 0
                AND image_child.del = 0
                AND copyright.show = 0
                AND copyright.default = 1
                AND image.id = image_child.id
                UNION
                SELECT copyright.*
                FROM "public"."copyrights" AS copyright
                WHERE copyright.del = 0
                AND copyright.show = 0
                AND copyright.default = 0
            ) t
        ) AS copyrights
    FROM 
        "public"."images" AS image
    INNER JOIN "public"."images_albums_relation" AS relation
        ON image.id = relation."imageId"
    INNER JOIN "public"."albums" AS albums
        ON relation.album_value = albums.album_value
    WHERE
        image.del = 0
    AND
        albums.del = 0
    AND
        image.show = 0
    AND
        albums.show = 0
    AND
        albums.album_value = ${album}
    ORDER BY ${orderBy}
    LIMIT 16 OFFSET ${(pageNum - 1) * 16}
  `;
}

export async function fetchClientImagesPageTotalByAlbum(album: string) {
  const customIndexStyle = await db.configs.findUnique({
    where: {
      config_key: 'custom_index_style',
    },
    select: {
      id: true,
      config_key: true,
      config_value: true,
      detail: true
    }
  });
  if (customIndexStyle?.config_value === '1' && album === '/') {
    const pageTotal = await db.$queryRaw`
    SELECT COALESCE(COUNT(1),0) AS total
    FROM (
        SELECT DISTINCT ON (image.id)
           image.id
        FROM
           "public"."images" AS image
        WHERE
            image.del = 0
        AND
            image.show = 0
        AND
            image.show_on_mainpage = 0
    ) AS unique_images;
  `
    // @ts-ignore
    return Number(pageTotal[0].total) > 0 ? Math.ceil(Number(pageTotal[0].total) / 16) : 0
  }
  const pageTotal = await db.$queryRaw`
    SELECT COALESCE(COUNT(1),0) AS total
    FROM (
        SELECT DISTINCT ON (image.id)
           image.id
        FROM
           "public"."images" AS image
        INNER JOIN "public"."images_albums_relation" AS relation
            ON image.id = relation."imageId"
        INNER JOIN "public"."albums" AS albums
            ON relation.album_value = albums.album_value
        WHERE
            image.del = 0
        AND
            albums.del = 0
        AND
            image.show = 0
        AND
            albums.show = 0
        AND
            albums.album_value = ${album}
    ) AS unique_images;
  `
  // @ts-ignore
  return Number(pageTotal[0].total) > 0 ? Math.ceil(Number(pageTotal[0].total) / 16) : 0
}

export async function fetchClientImagesListByTag(pageNum: number, tag: string) {
  if (pageNum < 1) {
    pageNum = 1
  }
  return await db.$queryRaw`
    SELECT 
        image.*,
        albums.name AS album_name,
        albums.id AS album_value,
        albums.allow_download AS album_allow_download,
        albums.license AS album_license,
        (
            SELECT json_agg(row_to_json(t))
            FROM (
                SELECT copyright.*
                FROM "public"."copyrights" AS copyright
                INNER JOIN "public"."images_copyright_relation" AS icrelation
                    ON copyright.id = icrelation."copyrightId"
                INNER JOIN "public"."images" AS image_child
                    ON icrelation."imageId" = image_child."id"
                WHERE copyright.del = 0
                AND image_child.del = 0
                AND copyright.show = 0
                AND image.id = image_child.id
            ) t
        ) AS copyrights
    FROM 
        "public"."images" AS image
    INNER JOIN "public"."images_albums_relation" AS relation
        ON image.id = relation."imageId"
    INNER JOIN "public"."albums" AS albums
        ON relation.album_value = albums.album_value
    WHERE
        image.del = 0
    AND
        albums.del = 0
    AND
        image.show = 0
    AND
        albums.show = 0
    AND
        image.labels::jsonb @> ${JSON.stringify([tag])}::jsonb
    ORDER BY image.sort DESC, image.created_at DESC, image.updated_at DESC
    LIMIT 16 OFFSET ${(pageNum - 1) * 16}
  `;
}

export async function fetchClientImagesPageTotalByTag(tag: string) {
  const pageTotal = await db.$queryRaw`
    SELECT COALESCE(COUNT(1),0) AS total
    FROM (
        SELECT DISTINCT ON (image.id)
           image.id
        FROM
           "public"."images" AS image
        INNER JOIN "public"."images_albums_relation" AS relation
            ON image.id = relation."imageId"
        INNER JOIN "public"."albums" AS albums
            ON relation.album_value = albums.album_value
        WHERE
            image.del = 0
        AND
            albums.del = 0
        AND
            image.show = 0
        AND
            albums.show = 0
        AND
            image.labels::jsonb @> ${JSON.stringify([tag])}::jsonb
    ) AS unique_images;
  `
  // @ts-ignore
  return Number(pageTotal[0].total) > 0 ? Math.ceil(Number(pageTotal[0].total) / 16) : 0
}

export async function fetchAlbumsShow() {
  return await db.albums.findMany({
    where: {
      del: 0,
      show: 0,
      album_value: {
        not: '/'
      }
    },
    orderBy: [
      {
        sort: 'desc'
      }
    ]
  });
}

export async function fetchAlbumsShowOptions() {
  const data = await db.configs.findFirst({
    where: {
      config_key: 'custom_fold_album_enable'
    },
    select: {
      config_value: true
    }
  })
  const countData = await db.configs.findFirst({
    where: {
      config_key: 'custom_fold_album_count'
    },
    select: {
      config_value: true
    }
  })
  return {
    enabled: data?.config_value === 'true',
    count: parseInt(countData?.config_value || '6')
  }
}

export async function fetchImagesAnalysis() {
  const counts = await db.$queryRaw<[{ images_total: number, images_show: number, cr_total: number, tags_total: number }]>`
    SELECT 
      (SELECT COUNT(*) FROM "public"."images" WHERE del = 0) as images_total,
      (SELECT COUNT(*) FROM "public"."images" WHERE del = 0 AND show = 0) as images_show,
      (SELECT COUNT(*) FROM "public"."copyrights" WHERE del = 0) as cr_total,
      (SELECT COUNT(*) FROM "public"."albums" WHERE del = 0) as tags_total
  `;

  const cameraStats = await db.$queryRaw`
    SELECT COUNT(*) as count, 
      COALESCE(exif->>'model', 'Unknown') as camera,
      COALESCE(exif->>'lens_model', 'Unknown') as lens
    FROM "public"."images"
    WHERE del = 0
    GROUP BY camera, lens
    ORDER BY count DESC
  `;

  const result = await db.$queryRaw`
    SELECT
        albums.name AS name,
        albums.album_value AS value,
        COALESCE(COUNT(1), 0) AS total,
        COALESCE(SUM(CASE WHEN image.show = 0 THEN 1 ELSE 0 END), 0) AS show_total
    FROM
        "public"."images" AS image
    INNER JOIN "public"."images_albums_relation" AS relation
        ON image.id = relation."imageId"
    INNER JOIN "public"."albums" AS albums
        ON relation.album_value = albums.album_value
    WHERE 
        image.del = 0
    AND
        albums.del = 0
    GROUP BY albums.name, albums.album_value
    ORDER BY total DESC
  `

  // @ts-ignore
  result.total = Number(result.total)
  // @ts-ignore
  result.show_total = Number(result.show_total)

  return {
    total: Number(counts[0].images_total),
    showTotal: Number(counts[0].images_show),
    crTotal: Number(counts[0].cr_total),
    tagsTotal: Number(counts[0].tags_total),
    cameraStats,
    result
  }
}

export async function fetchUserById(userId: string) {
  return await db.user.findUnique({
    where: {
      id: userId
    }
  })
}

export async function fetchSecretKey() {
  return await db.configs.findFirst({
    where: {
      config_key: 'secret_key'
    },
    select: {
      id: true,
      config_key: true,
      config_value: true
    }
  })
}

export async function fetchCopyrightList() {
  return await db.copyright.findMany({
    where: {
      del: 0,
    },
    orderBy: [
      {
        createdAt: 'desc',
      },
      {
        updatedAt: 'desc'
      }
    ]
  });
}

export async function fetchImageByIdAndAuth(id: string) {
  return await db.$queryRaw`
    SELECT
        "images".*,
        "albums".allow_download AS album_allow_download,
        "albums".license AS album_license
    FROM
        "images"
    INNER JOIN "images_albums_relation"
        ON "images"."id" = "images_albums_relation"."imageId"
    INNER JOIN "albums"
        ON "images_albums_relation".album_value = "albums".album_value
    WHERE
        "images".del = 0
    AND
        "albums".del = 0
    AND
        "images".show = 0
    AND
        "albums".show = 0
    AND
        "images".id = ${id}
  `;
}

export async function queryAuthStatus() {
  return await db.configs.findFirst({
    where: {
      config_key: 'auth_enable'
    },
    select: {
      id: true,
      config_key: true,
      config_value: true
    }
  });
}

export async function queryAuthTemplateSecret() {
  return await db.configs.findFirst({
    where: {
      config_key: 'auth_temp_secret'
    },
    select: {
      id: true,
      config_key: true,
      config_value: true
    }
  });
}

export async function queryAuthSecret() {
  return await db.configs.findFirst({
    where: {
      config_key: 'auth_secret'
    },
    select: {
      id: true,
      config_key: true,
      config_value: true
    }
  });
}

export async function getRSSImages() {
  // 每个相册取最新 10 张照片
  return await db.$queryRaw`
    WITH RankedImages AS (
    SELECT
      i.*,
      A.album_value,
      ROW_NUMBER() OVER (PARTITION BY A.album_value ORDER BY i.created_at DESC) AS rn
    FROM
      images i
      INNER JOIN images_albums_relation iar ON i.ID = iar."imageId"
      INNER JOIN albums A ON iar.album_value = A.album_value
    WHERE
      A.del = 0
      AND A."show" = 0
      AND i.del = 0
      AND i."show" = 0
    )
    SELECT *
    FROM RankedImages
    WHERE rn <= 10;
  `;
}
