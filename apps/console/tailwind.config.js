/*
Copyright The CryptOS Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import { cryptosPreset, uiContent } from "@cryptos-pki/ui/tailwind-preset";

// The theme (the token colours, radius, fonts and motion) lives in the kit's
// shared preset, so the console and @cryptos-pki/ui resolve the same classes.
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", ...uiContent],
  presets: [cryptosPreset],
};
