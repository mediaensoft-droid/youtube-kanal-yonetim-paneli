// @types/yandex-maps only declares the ambient `ymaps` namespace/module — it doesn't attach it
// to `window`, since the actual attachment happens at runtime once the Yandex Maps JS API
// script tag finishes loading (see CountryYandexMap.tsx).
export {};

declare global {
  interface Window {
    ymaps?: typeof ymaps;
  }
}
