import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

import { register as registerSwiperElements } from 'swiper/element/bundle'
import '../node_modules/swiper/swiper.min.css'
import '../node_modules/swiper/modules/pagination.min.css'
registerSwiperElements();

const bootstrap = () => bootstrapApplication(AppComponent, config);

export default bootstrap;
