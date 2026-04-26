import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core"
import { NgbModal, NgbModalModule } from "@ng-bootstrap/ng-bootstrap"
import { IconComponent } from "@revive/src/app/icon/icon.component"
import { ExpandedImageComponent } from "@components/expanded-image/expanded-image.component"
import { NavbarComponent } from "../components/navbar/navbar.component"
import { FooterComponent } from "../components/footer/footer.component"
import { VideoModalComponent } from "../components/video-modal/video-modal.component"

@Component ( {
  selector: "app-gallery",
  imports: [
    NavbarComponent,
    FooterComponent,
    IconComponent,
    NgbModalModule
  ],
  templateUrl: "./gallery.component.html",
  styleUrl: "./gallery.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class GalleryComponent {
  // Simple in-component media list. Each item can be an image (jpg/png) or a video (mp4).
  public galleries = signal ( [
    { url: "dunoon/dunoon-", type: "jpg", gallery: "dunoon", number: 40, startingIndex: 1 },
    { url: "dunoon/dunoon-", type: "mp4", gallery: "dunoon", number: 1, startingIndex: 41 },
    { url: "kinloss/kinloss-", type: "jpg", gallery: "kinloss", number: 13, startingIndex: 1 },
    { url: "kinloss/kinloss-", type: "mp4", gallery: "kinloss", number: 1, startingIndex: 14 },
    { url: "skye/skye-", type: "jpg", gallery: "skye", number: 7, startingIndex: 1 },
  ] )

  public filter = signal <"dunoon" | "kinloss" | "skye"> ( "dunoon" )

  private readonly modalSvc: NgbModal = inject ( NgbModal )

  public get filtered ( ) {
    const f = this.filter ( )
    // Calculate all media urls based on the gallery definitions and types and starting index
    // for example array of strings: dunoon/dunoon-1.jpg, dunoon/dunoon-2.jpg, ..., dunoon/dunoon-40.jpg, dunoon/dunoon-41.mp4, kinloss/kinloss-1.jpg, ..., skye/skye-7.jpg
    const media = [ ]
    for ( const gallery of this.galleries ( ) ) {
      if ( gallery.gallery === f ) {
        for ( let i = 0; i < gallery.number; i++ ) {
          media.push ( { url: gallery.url + ( gallery.startingIndex + i ) + "." + gallery.type, type: gallery.type === "mp4" ? "video" : "image" } )
        }
      }
    }
    return media
  }

  public openImage ( index: number ) {
    const images = this.filtered.filter ( m => m.type === "image" ).map ( m => m.url )
    const reference = this.modalSvc.open ( ExpandedImageComponent, { size: "lg", centered: true } )
    reference.componentInstance.imageURLs = images
    reference.componentInstance.index = index
  }

  public openVideo ( url: string ) {
    const ref = this.modalSvc.open ( VideoModalComponent, { size: "lg", centered: true } )
    ref.componentInstance.videoUrl = url
  }

  public setFilter ( f: "dunoon" | "kinloss" | "skye" ) {
    this.filter.set ( f )
  }
}
