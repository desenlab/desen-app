import type { ThemeAuthoringDocument } from "./theme-authoring.js";

function freezeNeutral<Value>(value: Value): Value {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeNeutral(child);
  return Object.freeze(value);
}

/**
 * Editable DESEN Neutral foundation with explicit light and dark DTCG source overlays.
 *
 * @remarks Neutral is intentionally restrained rather than restrictive. Every value is an ordinary
 * authoring default and can be replaced by any literal supported by the frozen T02 profile. The
 * low-contrast border token is decorative; the separate focus token provides the strong control
 * boundary. No remote font, proprietary palette, runtime behavior, or protocol extension is used.
 */
export const DESEN_NEUTRAL_THEME_DOCUMENT: ThemeAuthoringDocument = freezeNeutral({
  kind: "desen.theme-authoring",
  schemaVersion: 1,
  themes: [
    {
      id: "desen-neutral",
      name: "DESEN Neutral",
      base: {
        id: "neutral.base",
        description: "Shared semantic aliases, spacing, radius, and system typography.",
        document: {
          color: {
            $type: "color",
            canvas: { $value: "{palette.canvas}" },
            surface: { $value: "{palette.surface}" },
            elevated: { $value: "{palette.elevated}" },
            foreground: { $value: "{palette.foreground}" },
            action: { $value: "{palette.action}" },
            onAction: { $value: "{palette.onAction}" },
            muted: { $value: "{palette.muted}" },
            disabled: { $value: "{palette.disabled}" },
            border: { $value: "{palette.border}" },
            focus: { $value: "{palette.focus}" },
            positive: { $value: "{palette.positive}" },
            caution: { $value: "{palette.caution}" },
            danger: { $value: "{palette.danger}" },
          },
          space: {
            $type: "dimension",
            1: { $value: { unit: "px", value: 4 } },
            2: { $value: { unit: "px", value: 8 } },
            3: { $value: { unit: "px", value: 12 } },
            4: { $value: { unit: "px", value: 16 } },
            6: { $value: { unit: "px", value: 24 } },
            8: { $value: { unit: "px", value: 32 } },
            12: { $value: { unit: "px", value: 48 } },
          },
          radius: {
            $type: "dimension",
            small: { $value: { unit: "px", value: 4 } },
            medium: { $value: { unit: "px", value: 8 } },
            large: { $value: { unit: "px", value: 12 } },
          },
          stroke: {
            $type: "dimension",
            default: { $value: { unit: "px", value: 1 } },
            focus: { $value: { unit: "px", value: 2 } },
          },
          opacity: {
            $type: "number",
            disabled: { $value: 0.48 },
          },
          typography: {
            $type: "typography",
            body: {
              $value: {
                fontFamily: ["ui-sans-serif", "system-ui", "sans-serif"],
                fontSize: { unit: "px", value: 16 },
                fontWeight: 400,
                letterSpacing: { unit: "px", value: 0 },
                lineHeight: 1.5,
              },
            },
            label: {
              $value: {
                fontFamily: ["ui-sans-serif", "system-ui", "sans-serif"],
                fontSize: { unit: "px", value: 14 },
                fontWeight: 600,
                letterSpacing: { unit: "px", value: 0 },
                lineHeight: 1.4,
              },
            },
            subtitle: {
              $value: {
                fontFamily: ["ui-sans-serif", "system-ui", "sans-serif"],
                fontSize: { unit: "px", value: 20 },
                fontWeight: 600,
                letterSpacing: { unit: "px", value: -0.1 },
                lineHeight: 1.3,
              },
            },
            title: {
              $value: {
                fontFamily: ["ui-sans-serif", "system-ui", "sans-serif"],
                fontSize: { unit: "px", value: 24 },
                fontWeight: 650,
                letterSpacing: { unit: "px", value: -0.25 },
                lineHeight: 1.2,
              },
            },
            display: {
              $value: {
                fontFamily: ["ui-sans-serif", "system-ui", "sans-serif"],
                fontSize: { unit: "px", value: 32 },
                fontWeight: 650,
                letterSpacing: { unit: "px", value: -0.5 },
                lineHeight: 1.15,
              },
            },
          },
        },
      },
      modes: [
        {
          id: "light",
          name: "Light",
          source: {
            id: "neutral.light",
            description: "DESEN Neutral light palette.",
            document: {
              palette: {
                $type: "color",
                canvas: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.9803921569, 0.9803921569, 0.9803921569],
                  },
                },
                surface: { $value: { colorSpace: "srgb", components: [1, 1, 1] } },
                elevated: { $value: { colorSpace: "srgb", components: [1, 1, 1] } },
                foreground: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.0901960784, 0.0901960784, 0.0901960784],
                  },
                },
                action: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.0901960784, 0.0901960784, 0.0901960784],
                  },
                },
                onAction: { $value: { colorSpace: "srgb", components: [1, 1, 1] } },
                muted: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.3215686275, 0.3215686275, 0.3215686275],
                  },
                },
                disabled: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.4509803922, 0.4509803922, 0.4509803922],
                  },
                },
                border: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.8980392157, 0.8980392157, 0.8980392157],
                  },
                },
                focus: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.1450980392, 0.3882352941, 0.9215686275],
                  },
                },
                positive: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.0823529412, 0.5019607843, 0.2392156863],
                  },
                },
                caution: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.7137254902, 0.3843137255, 0.0274509804],
                  },
                },
                danger: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.862745098, 0.1490196078, 0.1490196078],
                  },
                },
              },
              elevation: {
                $type: "shadow",
                card: {
                  $value: {
                    blur: { unit: "px", value: 18 },
                    color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.08 },
                    offsetX: { unit: "px", value: 0 },
                    offsetY: { unit: "px", value: 8 },
                    spread: { unit: "px", value: 0 },
                  },
                },
              },
            },
          },
        },
        {
          id: "dark",
          name: "Dark",
          source: {
            id: "neutral.dark",
            description: "DESEN Neutral dark palette.",
            document: {
              palette: {
                $type: "color",
                canvas: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.0392156863, 0.0392156863, 0.0392156863],
                  },
                },
                surface: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.0901960784, 0.0901960784, 0.0901960784],
                  },
                },
                elevated: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.1490196078, 0.1490196078, 0.1490196078],
                  },
                },
                foreground: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.9803921569, 0.9803921569, 0.9803921569],
                  },
                },
                action: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.9803921569, 0.9803921569, 0.9803921569],
                  },
                },
                onAction: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.0392156863, 0.0392156863, 0.0392156863],
                  },
                },
                muted: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.6392156863, 0.6392156863, 0.6392156863],
                  },
                },
                disabled: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.6392156863, 0.6392156863, 0.6392156863],
                  },
                },
                border: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.2509803922, 0.2509803922, 0.2509803922],
                  },
                },
                focus: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.3764705882, 0.6470588235, 0.9803921569],
                  },
                },
                positive: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.2901960784, 0.8705882353, 0.5019607843],
                  },
                },
                caution: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.9843137255, 0.7490196078, 0.1411764706],
                  },
                },
                danger: {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.9725490196, 0.4431372549, 0.4431372549],
                  },
                },
              },
              elevation: {
                $type: "shadow",
                card: {
                  $value: {
                    blur: { unit: "px", value: 20 },
                    color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.5 },
                    offsetX: { unit: "px", value: 0 },
                    offsetY: { unit: "px", value: 10 },
                    spread: { unit: "px", value: 0 },
                  },
                },
              },
            },
          },
        },
      ],
      extensions: {
        "org.desen.role": "editable-default",
        "org.desen.version": 1,
      },
    },
  ],
});
