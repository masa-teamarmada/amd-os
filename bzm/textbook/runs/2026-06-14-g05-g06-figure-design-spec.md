# G05/G06 Figure Design Spec

Date: 2026-06-14 JST
Scope: design source of truth for rebuilding `g05_timeline_before_zero.svg` and `g06_uncertainty_map.svg`.

## Executive Status

This note is the design source of truth for the two opening figures in `field-before-zero.md`.
The purpose is to avoid "decorative boxes" and define, before drawing, exactly what each figure must communicate, what objects appear, how they are placed, and how they are connected.

## G05: Before Zero Timeline

### What This Figure Must Show

The figure must show that the period from a research result to incorporation is a long runway, not an empty waiting room.
The core problem is not born at the instant of incorporation. During the runway, several hard-to-reverse decisions are embedded into the project, and those decisions later surface as company constraints.

### Core Message

Company formation is not the beginning of the problem. It is the moment when earlier choices gain a legal and operational container.

### Objects

- Left endpoint: `研究成果`
  - sublabel: `論文 / 発表 / 発明の兆し`
- Central long band: `Before Zero`
  - phases:
    - `探索`
    - `事業化仮説`
    - `外部接触`
    - `設立準備`
- Right endpoint: `ゼロ`
  - sublabel: `法人設立 / 事業開始`
- Time arrow below the central band:
  - label: `時間 — しばしば十年以上`
- Decision row below the timeline:
  - `出願と公開の順序`
  - `用途の選択`
  - `担い手`
  - `初期の資本構成`
- Footer note:
  - `ゼロの瞬間に問題が生まれるのではなく、助走区間で仕込まれた歪みが会社という器を得て表面化する。`

### Placement

- Top area is a single horizontal timeline.
- `研究成果` is outside the Before Zero band on the left.
- `ゼロ` is outside the Before Zero band on the right.
- The Before Zero band is one continuous green runway divided into four equal phases.
- The decision row sits below the timeline and contains four equal cards, horizontally aligned with the relevant phase rather than stacked in two columns.
- Cards must not connect to each other. They are not a causal chain; they are constraints embedded at different points in the runway.

### Connections

- A single orange time arrow runs left to right below the runway.
- Each decision card connects upward to the phase where it is embedded through a short vertical orange "pin".
- No cross-card arrows.
- No arrows from decisions to `ゼロ`; the caption and layout carry that meaning.

### Must Avoid

- Do not make `ゼロ` look like the final goal.
- Do not make the four phases look like a guaranteed success process.
- Do not make the decision cards look like a generic checklist.
- Do not draw long arrows that cross text or boxes.

## G06: Uncertainty Map

### What This Figure Must Show

The figure must show that a research result alone is not enough to judge company readiness.
Around the research result are seven unresolved domains. These domains are interdependent: moving one domain changes several others.
Incorporation does not erase those uncertainties; it carries them forward into a more expensive container.

### Core Message

Before Zero is a coupled uncertainty system. A single move changes multiple domains, and company formation does not make the seven domains disappear.

### Objects

- Center: `研究成果`
  - sublabel: `シーズ`
- Surrounding seven domains:
  - `研究の再現性`
    - sublabel: `別の場所・人・規模で出るか`
  - `用途`
    - sublabel: `何に使うと価値になるか`
  - `顧客`
    - sublabel: `誰が痛みと予算を持つか`
  - `知財と公開の順序`
    - sublabel: `出願・発表・開示の順番`
  - `担い手`
    - sublabel: `誰がどの機能を背負うか`
  - `資金`
    - sublabel: `何に使える資金か`
  - `制度`
    - sublabel: `契約・兼業・利益相反・規制`

### Placement

Place the seven domains around the center by semantic neighborhood, not merely by symmetry:

- top: `研究の再現性`
- upper right: `用途`
- right: `顧客`
- lower right: `知財と公開の順序`
- bottom: `担い手`
- lower left: `資金`
- left: `制度`

The center should be the origin, not the dominant visual object. The outer domains are the main object of reading.

### Connections

- Use thin neutral lines from the center to the seven domains.
  - Meaning: the research result raises questions in each domain.
- Use stronger orange lines between especially coupled domain pairs.
  - `研究の再現性` to `用途`
  - `用途` to `顧客`
  - `用途` to `知財と公開の順序`
  - `顧客` to `資金`
  - `資金` to `担い手`
  - `担い手` to `制度`
  - `制度` to `知財と公開の順序`
- The outer-domain connections should be undirected or visually close to undirected. The point is interdependence, not one-way causality.

### Must Avoid

- Do not draw seven aggressive arrows from the center that make the research result look like the sole driver.
- Do not make the seven domains look like a checklist to fill out.
- Do not imply that incorporation solves the uncertainties.
- Do not let the center dominate the outer system.

