/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

import { register as registerSwiperElements } from 'swiper/element/bundle'

registerSwiperElements ( )
// Add CUSTOM_ELEMENTS_SCHEMA to the definition of any component(s) that use(s) the Swiper Element components.

const updateTheme = ( ) => {
  document.querySelector ( "html" )?.setAttribute ( "data-bs-theme",
      window.matchMedia ( "(prefers-color-scheme: dark)" ).matches ? "dark" : "light" )
}

window.matchMedia ( "(prefers-color-scheme: dark)" ).addEventListener ( "change", ( ) => {
  updateTheme ( )
} )

updateTheme ( )

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));