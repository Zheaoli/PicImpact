export type AlbumDataProps = {
  data: AlbumType[]
  customFoldAlbumEnable: boolean
  customFoldAlbumCount: number
}

export type HandleProps = {
  handle: () => any
  args: string
}

export type ImageServerHandleProps = {
  handle: (pageNum: number, tag: string) => any
  args: string
  totalHandle: (tag: string) => any
}

export type ImageHandleProps = {
  handle: (pageNum: number, tag: string) => any
  args: string
  album: string
  totalHandle: (tag: string) => any
  configHandle: () => any
  randomShow?: boolean
}

export type LinkProps = {
  handle: () => any
  args: string
  data: any
}

export type AlbumType = {
  id: string;
  name: string;
  album_value: string;
  detail: string | null;
  show: number;
  sort: number;
  allow_download: number;
  license: string | null;
  image_sorting: number;
  randomShow: number;
  del?: number;
  createdAt?: Date;
  updatedAt?: Date | null;
}

export type ExifType = {
  make: any;
  model: any;
  bits: any;
  data_time: any;
  exposure_time: any;
  f_number: any;
  exposure_program: any;
  iso_speed_rating: any;
  focal_length: any;
  lens_specification: any;
  lens_model: any;
  exposure_mode: any;
  cfa_pattern: any;
  color_space: any;
  white_balance: any;
}

export type ImageType = {
  id: string;
  title: string;
  url: string;
  preview_url: string;
  video_url: string;
  exif: ExifType;
  labels: any;
  width: number;
  height: number;
  lon: string;
  lat: string;
  album: string;
  detail: string;
  type: number; // type: 图片类型为 1，livephoto 类型为 2
  show: number;
  show_on_mainpage: number;
  sort: number;
  album_name: string;
  album_value: string;
  album_allow_download: number; // 映射自相册下载权限
  album_license: string;
  copyrights: any[];
}

export type CopyrightType = {
  id: string;
  name: string;
  social_name: string;
  type: string;
  url: string;
  avatar_url: string;
  detail: string;
  default: number;
  show: number;
}

export type Config = {
  id: string;
  config_key: string;
  config_value: string;
  detail: string;
}

export type AlbumListProps = {
  data: AlbumType[]
}

export type ImageDataProps = {
  data: ImageType
}

export type ImageListDataProps = {
  data: ImageType[]
}

export type AnalysisDataProps = {
  data: {
    total: number;
    showTotal: number;
    crTotal: number;
    tagsTotal: number;
    cameraStats: Array<{
      camera: string;
      lens: string;
      count: number;
    }>;
    result: Array<{
      name: string;
      value: string;
      total: number;
      show_total: number;
    }>;
  }
}
