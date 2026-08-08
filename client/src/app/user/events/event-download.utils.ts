import { ReviveEvent } from "@services/events.service"

const slugify = ( title: string ): string =>
  title.replace ( /[^\w]+/g, "-" ).toLowerCase ( ).replace ( /^-|-$/g, "" ) || "event"

export const getGoogleMapsUrl = ( location: string ): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent ( location )}`

export const downloadEventIcs = ( event: ReviveEvent ): void => {
  const pad = ( n: number ) => String ( n ).padStart ( 2, "0" )
  const toUtcStamp = ( d: Date ) =>
    `${d.getUTCFullYear ( )}${pad ( d.getUTCMonth ( ) + 1 )}${pad ( d.getUTCDate ( ) )}T${pad ( d.getUTCHours ( ) )}${pad ( d.getUTCMinutes ( ) )}00Z`

  const start = new Date ( event.startDate )
  const end = new Date ( event.endDate )
  if ( event.startTime ) {
    const [ h, m ] = event.startTime.split ( ":" ).map ( Number )
    start.setHours ( h || 0, m || 0, 0, 0 )
  }
  if ( event.endTime ) {
    const [ h, m ] = event.endTime.split ( ":" ).map ( Number )
    end.setHours ( h || 0, m || 0, 0, 0 )
  } else if ( end.getTime ( ) <= start.getTime ( ) ) {
    end.setTime ( start.getTime ( ) + 2 * 60 * 60 * 1000 )
  }

  const descriptionParts = [ event.description || "" ]
  if ( event.longDescription?.trim ( ) ) {
    descriptionParts.push ( event.longDescription.trim ( ) )
  }
  const description = descriptionParts.filter ( Boolean ).join ( "\n\n" )

  const escape = ( s: string ) => s.replace ( /\\/g, "\\\\" ).replace ( /;/g, "\\;" ).replace ( /,/g, "\\," ).replace ( /\n/g, "\\n" )
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Revive Scotland//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@revivescotland.co.uk`,
    `DTSTAMP:${toUtcStamp ( new Date ( ) )}`,
    `DTSTART:${toUtcStamp ( start )}`,
    `DTEND:${toUtcStamp ( end )}`,
    `SUMMARY:${escape ( event.title )}`,
    `DESCRIPTION:${escape ( description )}`,
    `LOCATION:${escape ( event.location || "" )}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join ( "\r\n" )

  const blob = new Blob ( [ ics ], { type: "text/calendar;charset=utf-8" } )
  const url = URL.createObjectURL ( blob )
  const a = document.createElement ( "a" )
  a.href = url
  a.download = `${slugify ( event.title )}.ics`
  a.click ( )
  URL.revokeObjectURL ( url )
}

export const downloadEventPoster = async ( event: ReviveEvent ): Promise<void> => {
  const imageUrl = event.imageUrl
  if ( !imageUrl ) return

  const filename = `${slugify ( event.title )}-poster.jpg`

  try {
    const res = await fetch ( imageUrl )
    if ( !res.ok ) throw new Error ( "fetch failed" )
    const blob = await res.blob ( )
    const objectUrl = URL.createObjectURL ( blob )
    const a = document.createElement ( "a" )
    a.href = objectUrl
    a.download = filename
    a.click ( )
    URL.revokeObjectURL ( objectUrl )
  } catch {
    window.open ( imageUrl, "_blank", "noopener,noreferrer" )
  }
}
