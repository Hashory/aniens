import { Component, signal } from '@angular/core';
import { MainLayoutComponent } from '#app/features/main/main-layout/main-layout.component';

@Component({
  selector: 'app-aniens-main',
  imports: [MainLayoutComponent],
  template: ` <app-main-layout />`,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
    `,
  ],
})
export class AniensMainComponent {
  protected readonly title = signal('aniens');
}
