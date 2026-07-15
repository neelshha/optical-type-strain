# Optical Type Strain

Body copy that physically resists the cursor. Glyphs shear, slip, and thicken under pressure, then settle back into reading order.

## Install

```bash
npm install github:neelshha/optical-type-strain
```

```tsx
import { OpticalTypeStrain } from "@neelshha/optical-type-strain";
import "@neelshha/optical-type-strain/styles.css";

export function Demo() {
  return <OpticalTypeStrain />;
}
```

## Props

| Prop | Default | Description |
|------|---------|-------------|
| `text` | sample paragraph | Source copy (`\n` starts a new line) |
| `radius` | `120` | Influence radius in px |
| `push` | `14` | Max displacement in px |
| `skew` | `12` | Max skew in degrees |
| `className` | — | Extra class on the root |

## License

MIT
