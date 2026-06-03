// react-simple-maps v3 は型定義を同梱せず、@types/react-simple-maps は
// React 17 向け peer で React 19 と衝突するため、必要な分だけ最小宣言する。
declare module "react-simple-maps" {
  import type { ComponentType, ReactNode, CSSProperties } from "react";

  interface GeographyShape {
    rsmKey: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }

  export const ComposableMap: ComponentType<{
    projection?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projectionConfig?: Record<string, any>;
    width?: number;
    height?: number;
    style?: CSSProperties;
    className?: string;
    children?: ReactNode;
  }>;

  export const ZoomableGroup: ComponentType<{
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    children?: ReactNode;
  }>;

  export const Geographies: ComponentType<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geography: string | Record<string, any>;
    children: (args: { geographies: GeographyShape[] }) => ReactNode;
  }>;

  export const Geography: ComponentType<{
    geography: GeographyShape;
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    style?: {
      default?: CSSProperties;
      hover?: CSSProperties;
      pressed?: CSSProperties;
    };
  }>;

  export const Marker: ComponentType<Record<string, unknown>>;
  export const Annotation: ComponentType<Record<string, unknown>>;
  export const Graticule: ComponentType<Record<string, unknown>>;
  export const Sphere: ComponentType<Record<string, unknown>>;
  export const Line: ComponentType<Record<string, unknown>>;
}
