import {} from 'styled-components'
import { ThemeType } from './theme/theme';
declare module "styled-components" {
  export interface DefaultTheme extends ThemeType {}
}