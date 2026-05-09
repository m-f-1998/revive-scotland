import { inject, Injectable } from "@angular/core"
import { Dialog, DialogConfig } from "@angular/cdk/dialog"
import { ComponentType } from "@angular/cdk/portal"

export class ModalRef<T = unknown, R = unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly componentInstance: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly result: Promise<any>

  private resolveFn!: ( value: R ) => void
  private rejectFn!: ( reason: unknown ) => void

  public constructor ( private readonly cdkRef: import ( "@angular/cdk/dialog" ).DialogRef<R, T> ) {
    this.componentInstance = cdkRef.componentInstance as T

    this.result = new Promise<R> ( ( resolve, reject ) => {
      this.resolveFn = resolve
      this.rejectFn = reject
    } )

    cdkRef.closed.subscribe ( {
      next: result => {
        if ( result !== undefined ) {
          this.resolveFn ( result )
        } else {
          this.rejectFn ( "dismissed" )
        }
      }
    } )
  }

  public setInput ( name: string, value: unknown ): void {
    this.cdkRef.componentRef?.setInput ( name, value )
  }

  public close ( result?: R ): void {
    this.cdkRef.close ( result )
  }

  public dismiss ( reason?: unknown ): void {
    this.cdkRef.close ( undefined )
    if ( reason !== undefined ) {
      this.rejectFn ( reason )
    }
  }
}

export interface ModalOptions {
  size?: "sm" | "md" | "lg" | "xl"
  centered?: boolean
  backdrop?: "static" | boolean
}

@Injectable ( { providedIn: "root" } )
export class ModalService {
  private readonly dialog = inject ( Dialog )

  public open<T, R = unknown> ( component: ComponentType<T>, options: ModalOptions = { } ): ModalRef<T, R> {
    const panelClasses = [ "modal-panel" ]
    if ( options.size && options.size !== "md" ) panelClasses.push ( `modal-${options.size}` )

    const config: DialogConfig<unknown, import ( "@angular/cdk/dialog" ).DialogRef<R, T>> = {
      panelClass: panelClasses,
      backdropClass: "modal-backdrop",
      hasBackdrop: true,
      disableClose: options.backdrop === "static",
      autoFocus: true,
      restoreFocus: true,
    }

    const cdkRef = this.dialog.open<R, unknown, T> ( component, config )
    return new ModalRef<T, R> ( cdkRef )
  }
}
