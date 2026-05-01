import {
  faArrowRight,
  faArrowUp,
  faArrowUpLong,
  faBible,
  faCalendar,
  faCalendarAlt,
  faCalendarDays,
  faCheckCircle,
  faChevronCircleDown,
  faChevronCircleUp,
  faChevronLeft,
  faChevronRight,
  faChurch,
  faCloudUploadAlt,
  faCross,
  faDownload,
  faEdit,
  faEnvelope,
  faExclamationTriangle,
  faExpand,
  faFileAlt,
  faFileUpload,
  faFolder,
  faFolderOpen,
  faFolderPlus,
  faGaugeHigh,
  faHome,
  faImage,
  faInfoCircle,
  faMapMarker,
  faPenToSquare,
  faPhone,
  faPlayCircle,
  faPlus,
  faPlusCircle,
  faPrayingHands,
  faRefresh,
  faRightFromBracket,
  faSave,
  faShare,
  faSignOutAlt,
  faSpinner,
  faTrash,
  faTrashAlt,
  faUserFriends
} from "@fortawesome/free-solid-svg-icons"
import { faInstagram } from "@fortawesome/free-brands-svg-icons"

const icons = {
  "fas": {
    "arrow-right": faArrowRight,
    "arrow-up": faArrowUp,
    "arrow-up-long": faArrowUpLong,
    "bible": faBible,
    "calendar": faCalendar,
    "calendar-alt": faCalendarAlt,
    "calendar-days": faCalendarDays,
    "check-circle": faCheckCircle,
    "chevron-circle-down": faChevronCircleDown,
    "chevron-circle-up": faChevronCircleUp,
    "chevron-left": faChevronLeft,
    "chevron-right": faChevronRight,
    "church": faChurch,
    "cloud-upload-alt": faCloudUploadAlt,
    "cross": faCross,
    "download": faDownload,
    "edit": faEdit,
    "envelope": faEnvelope,
    "expand": faExpand,
    "file-alt": faFileAlt,
    "file-upload": faFileUpload,
    "folder": faFolder,
    "folder-open": faFolderOpen,
    "folder-plus": faFolderPlus,
    "gauge-high": faGaugeHigh,
    "home": faHome,
    "image": faImage,
    "info-circle": faInfoCircle,
    "map-marker": faMapMarker,
    "pen-to-square": faPenToSquare,
    "phone": faPhone,
    "play-circle": faPlayCircle,
    "plus": faPlus,
    "plus-circle": faPlusCircle,
    "praying-hands": faPrayingHands,
    "refresh": faRefresh,
    "right-from-bracket": faRightFromBracket,
    "trash": faTrash,
    "trash-alt": faTrashAlt,
    "user-friends": faUserFriends,
    "save": faSave,
    "share": faShare,
    "sign-out-alt": faSignOutAlt,
    "spinner": faSpinner,
    "triangle-exclamation": faExclamationTriangle,
  },
  "fab": {
    "instagram": faInstagram,
  }
}

export const getIcon = ( icon: SolidIcon | BrandIcon ) => {
  if ( icon in icons.fas ) {
    return icons.fas [ icon as SolidIcon ]
  } else if ( icon in icons.fab ) {
    return icons.fab [ icon as BrandIcon ]
  } else {
    console.warn ( `Icon not found: ${icon}` )
    return icons.fas [ "exclamation-triangle" as SolidIcon ]
  }
}

export type BrandIcon = keyof typeof icons.fab
export type SolidIcon = keyof typeof icons.fas