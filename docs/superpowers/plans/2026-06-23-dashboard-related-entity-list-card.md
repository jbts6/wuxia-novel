# Dashboard Related Entity List Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract repeated dashboard related-entity list rendering into one tested `RelatedEntityListCard` module, then adopt it in the card modules that already render simple clickable related entity rows.

**Architecture:** Keep entity lookup and data shaping inside the existing card modules. Add one small, deep rendering module whose interface accepts a card title, display-ready rows, an optional row limit, and an optional select callback. This hides the repeated Ant Design `Card`, row spacing, border, cursor, name, badge, and secondary-description rendering without changing store state, route state, or entity data shapes.

**Tech Stack:** React, TypeScript, Ant Design, Vitest, Testing Library, Zustand store selectors, existing dashboard card modules.

---

## Current Context

- Work from `main`.
- At plan creation, `main` is clean and locally ahead of `origin/main` by 3 commits.
- Before implementation, create a new branch from current `main`.
- Use `rtk` for shell commands.
- Use TDD for the new rendering module.
- Keep `dashboard/dist` and `dashboard/dist-static` out of commits.

## File Structure

- Create: `dashboard/src/components/cards/RelatedEntityListCard.tsx`
  - Owns the shared related-entity list card interface and rendering.
  - Returns `null` for empty lists.
  - Renders each row with stable spacing, border, name, optional badge, optional description, and optional click behavior.

- Create: `dashboard/src/components/cards/RelatedEntityListCard.test.tsx`
  - Tests the shared module through its public props.
  - Covers empty lists, title rendering, row content, row limit, badge rendering, and click callback.

- Modify: `dashboard/src/components/cards/ItemCard.tsx`
  - Replace the duplicated "关联技能" row list with `RelatedEntityListCard`.

- Modify: `dashboard/src/components/cards/LocationCard.tsx`
  - Replace the duplicated "关联势力" row list with `RelatedEntityListCard`.

- Modify: `dashboard/src/components/cards/SkillCard.tsx`
  - Replace "掌握此技能的人物" and "关联物品" row lists with `RelatedEntityListCard`.

- Modify: `dashboard/src/components/cards/FactionCard.tsx`
  - Replace the member row list with `RelatedEntityListCard`.
  - Preserve `displayRole` usage and role badge rendering.

- Modify: `dashboard/src/components/cards/FactionCard.test.tsx`
  - Keep the existing companion role-label regression.
  - Add a click assertion so the migrated member row still navigates to the character detail.

## Out of Scope

- Do not modify `CharacterCard.tsx` in this pass. Its relationship network has extra relationship-specific content, and it should be migrated only after this simpler module proves stable.
- Do not modify `DetailPanel.tsx`.
- Do not change entity lookup helpers, store shape, route/query behavior, data schemas, or visual theme tokens.
- Do not extract the top "basic info" card yet. Its variations are larger than this cleanup target.

## Testing Strategy

- New module tests should assert observable rendering and callback behavior, not implementation details or CSS class names.
- Existing card tests should cover card-level behavior that matters after migration, especially `FactionCard` role display and navigation.
- Type and integration safety comes from `rtk npm run build`.
- End-of-plan verification must run `rtk npm run lint`, `rtk npm run build`, and `rtk npm run test` from `dashboard/`.

---

### Task 0: Start The Refactor Branch

**Files:**
- Modify: none

- [ ] **Step 1: Confirm repository state**

Run from the repo root:

```bash
rtk git status --short --branch
```

Expected:

```text
* main...origin/main [ahead 3]
clean — nothing to commit
```

- [ ] **Step 2: Create the implementation branch**

Run from the repo root:

```bash
rtk git switch -c codex/dashboard-related-list-card
```

Expected:

```text
Switched to a new branch 'codex/dashboard-related-list-card'
```

---

### Task 1: Add The Failing Shared Module Test

**Files:**
- Create: `dashboard/src/components/cards/RelatedEntityListCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `dashboard/src/components/cards/RelatedEntityListCard.test.tsx` with this content:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RelatedEntityListCard from './RelatedEntityListCard';

describe('RelatedEntityListCard', () => {
  it('renders the limited related entity rows and selects a row by id', () => {
    const handleSelect = vi.fn();

    render(
      <RelatedEntityListCard
        title="关联实体"
        items={[
          {
            id: 'char_li_xun_huan',
            name: '李寻欢',
            description: '小李探花',
            badge: <span>主角</span>,
          },
          {
            id: 'char_tie_chuan_jia',
            name: '铁传甲',
            description: '忠义护卫',
          },
        ]}
        limit={1}
        onSelect={handleSelect}
      />,
    );

    expect(screen.getByText('关联实体')).toBeInTheDocument();
    expect(screen.getByText('李寻欢')).toBeInTheDocument();
    expect(screen.getByText('小李探花')).toBeInTheDocument();
    expect(screen.getByText('主角')).toBeInTheDocument();
    expect(screen.queryByText('铁传甲')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('李寻欢'));

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith('char_li_xun_huan');
  });

  it('renders nothing for an empty related entity list', () => {
    const { container } = render(
      <RelatedEntityListCard title="关联实体" items={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run from `dashboard/`:

```bash
rtk npm run test -- RelatedEntityListCard.test.tsx
```

Expected: FAIL because `./RelatedEntityListCard` does not exist.

Do not commit this failing state.

---

### Task 2: Implement RelatedEntityListCard

**Files:**
- Create: `dashboard/src/components/cards/RelatedEntityListCard.tsx`
- Test: `dashboard/src/components/cards/RelatedEntityListCard.test.tsx`

- [ ] **Step 1: Add a minimal module stub**

Create `dashboard/src/components/cards/RelatedEntityListCard.tsx` with this content:

```tsx
import React from 'react';

interface RelatedEntityListCardProps {
  title: React.ReactNode;
  items: [];
}

const RelatedEntityListCard: React.FC<RelatedEntityListCardProps> = () => null;

export default RelatedEntityListCard;
```

- [ ] **Step 2: Run the focused test to verify behavioral RED**

Run from `dashboard/`:

```bash
rtk npm run test -- RelatedEntityListCard.test.tsx
```

Expected: FAIL because the test cannot find the rendered title `关联实体`.

- [ ] **Step 3: Replace the stub with the implementation**

Replace the entire contents of `dashboard/src/components/cards/RelatedEntityListCard.tsx` with:

```tsx
import React, { type ReactNode } from 'react';
import { Card } from 'antd';
import { INK } from '../../theme/palette';

export interface RelatedEntityListItem {
  id: string;
  name: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
}

interface RelatedEntityListCardProps {
  title: ReactNode;
  items: RelatedEntityListItem[];
  limit?: number;
  onSelect?: (id: string) => void;
}

const RelatedEntityListCard: React.FC<RelatedEntityListCardProps> = ({
  title,
  items,
  limit,
  onSelect,
}) => {
  const visibleItems = limit === undefined ? items : items.slice(0, limit);

  if (visibleItems.length === 0) return null;

  return (
    <Card size="small" title={title} style={{ marginBottom: 16 }}>
      {visibleItems.map((item) => (
        <div
          key={item.id}
          style={{
            cursor: onSelect ? 'pointer' : undefined,
            padding: '8px 0',
            borderBottom: '1px solid var(--ink-hairline)',
          }}
          onClick={() => onSelect?.(item.id)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 500 }}>{item.name}</span>
            {item.badge}
          </div>
          {item.description && (
            <div style={{ color: INK.secondary, fontSize: 12 }}>
              {item.description}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
};

export default React.memo(RelatedEntityListCard);
```

- [ ] **Step 4: Run the focused test to verify GREEN**

Run from `dashboard/`:

```bash
rtk npm run test -- RelatedEntityListCard.test.tsx
```

Expected:

```text
Test Files  1 passed (1)
Tests  2 passed (2)
```

- [ ] **Step 5: Commit the shared module**

Run from the repo root:

```bash
rtk git add dashboard/src/components/cards/RelatedEntityListCard.tsx dashboard/src/components/cards/RelatedEntityListCard.test.tsx
rtk git commit -m "refactor: add related entity list card"
```

---

### Task 3: Adopt The Shared Module In ItemCard And LocationCard

**Files:**
- Modify: `dashboard/src/components/cards/ItemCard.tsx`
- Modify: `dashboard/src/components/cards/LocationCard.tsx`
- Test: `dashboard/src/components/cards/RelatedEntityListCard.test.tsx`

- [ ] **Step 1: Update ItemCard imports**

In `dashboard/src/components/cards/ItemCard.tsx`, add this import next to the other local card imports:

```tsx
import RelatedEntityListCard from './RelatedEntityListCard';
```

- [ ] **Step 2: Replace ItemCard related skill rendering**

In `dashboard/src/components/cards/ItemCard.tsx`, replace the full `relatedSkills.length > 0` card block with:

```tsx
      <RelatedEntityListCard
        title={<span><ThunderboltOutlined /> 关联技能</span>}
        items={relatedSkills.map((skill) => ({
          id: skill.id,
          name: skill.name,
          description: skill.one_line,
        }))}
        onSelect={(skillId) => showDetail('skill', skillId)}
      />
```

- [ ] **Step 3: Update LocationCard imports**

In `dashboard/src/components/cards/LocationCard.tsx`, add this import next to the other local card imports:

```tsx
import RelatedEntityListCard from './RelatedEntityListCard';
```

- [ ] **Step 4: Replace LocationCard related faction rendering**

In `dashboard/src/components/cards/LocationCard.tsx`, replace the full `relatedFactions.length > 0` card block with:

```tsx
      <RelatedEntityListCard
        title={<span><TeamOutlined /> 关联势力</span>}
        items={relatedFactions.map((faction) => ({
          id: faction.id,
          name: faction.name,
          description: faction.type,
        }))}
        onSelect={(factionId) => showDetail('faction', factionId)}
      />
```

- [ ] **Step 5: Run focused module tests**

Run from `dashboard/`:

```bash
rtk npm run test -- RelatedEntityListCard.test.tsx
```

Expected:

```text
Test Files  1 passed (1)
Tests  2 passed (2)
```

- [ ] **Step 6: Run TypeScript and Vite build**

Run from `dashboard/`:

```bash
rtk npm run build
```

Expected: build exits 0. The existing Vite large-chunk warning may still appear.

- [ ] **Step 7: Commit ItemCard and LocationCard adoption**

Run from the repo root:

```bash
rtk git add dashboard/src/components/cards/ItemCard.tsx dashboard/src/components/cards/LocationCard.tsx
rtk git commit -m "refactor: share simple related entity lists"
```

---

### Task 4: Adopt The Shared Module In SkillCard

**Files:**
- Modify: `dashboard/src/components/cards/SkillCard.tsx`
- Test: `dashboard/src/components/cards/RelatedEntityListCard.test.tsx`

- [ ] **Step 1: Add the SkillCard import**

In `dashboard/src/components/cards/SkillCard.tsx`, add this import next to the other local card imports:

```tsx
import RelatedEntityListCard from './RelatedEntityListCard';
```

- [ ] **Step 2: Replace SkillCard related character rendering**

In `dashboard/src/components/cards/SkillCard.tsx`, replace the full `relatedCharacters.length > 0` card block with:

```tsx
      <RelatedEntityListCard
        title={<span><UserOutlined /> 掌握此技能的人物</span>}
        items={relatedCharacters.map((char) => ({
          id: char.id,
          name: char.name,
          description: char.identity,
        }))}
        onSelect={(characterId) => showDetail('character', characterId)}
      />
```

- [ ] **Step 3: Replace SkillCard related item rendering**

In `dashboard/src/components/cards/SkillCard.tsx`, replace the full `relatedItems.length > 0` card block with:

```tsx
      <RelatedEntityListCard
        title="关联物品"
        items={relatedItems.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.one_line,
        }))}
        onSelect={(itemId) => showDetail('item', itemId)}
      />
```

- [ ] **Step 4: Run focused module tests**

Run from `dashboard/`:

```bash
rtk npm run test -- RelatedEntityListCard.test.tsx
```

Expected:

```text
Test Files  1 passed (1)
Tests  2 passed (2)
```

- [ ] **Step 5: Run TypeScript and Vite build**

Run from `dashboard/`:

```bash
rtk npm run build
```

Expected: build exits 0. The existing Vite large-chunk warning may still appear.

- [ ] **Step 6: Commit SkillCard adoption**

Run from the repo root:

```bash
rtk git add dashboard/src/components/cards/SkillCard.tsx
rtk git commit -m "refactor: share skill related entity lists"
```

---

### Task 5: Adopt The Shared Module In FactionCard

**Files:**
- Modify: `dashboard/src/components/cards/FactionCard.tsx`
- Modify: `dashboard/src/components/cards/FactionCard.test.tsx`
- Test: `dashboard/src/components/cards/FactionCard.test.tsx`
- Test: `dashboard/src/components/cards/RelatedEntityListCard.test.tsx`

- [ ] **Step 1: Add the FactionCard import**

In `dashboard/src/components/cards/FactionCard.tsx`, add this import next to the other local card imports:

```tsx
import RelatedEntityListCard from './RelatedEntityListCard';
```

- [ ] **Step 2: Replace FactionCard member rendering**

In `dashboard/src/components/cards/FactionCard.tsx`, replace the full `members.length > 0` card block with:

```tsx
      <RelatedEntityListCard
        title={<span><UserOutlined /> 成员 ({members.length})</span>}
        items={members.map((char) => ({
          id: char.id,
          name: char.name,
          description: char.identity,
          badge: (
            <InkTag color={char.role}>
              {displayRole(char.role)}
            </InkTag>
          ),
        }))}
        onSelect={(characterId) => showDetail('character', characterId)}
      />
```

- [ ] **Step 3: Expand the FactionCard regression test**

In `dashboard/src/components/cards/FactionCard.test.tsx`, update the test setup so `showDetail` is captured and the row click is asserted.

Change the imports to include `fireEvent`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
```

Inside the existing test, replace the inline `showDetail: vi.fn(),` state entry with a captured function:

```tsx
    const showDetail = vi.fn();
    withStoreState({
      factions: [faction],
      characters: [companion],
      locations: [],
      showDetail,
    });
```

After the existing label assertions, add:

```tsx
    fireEvent.click(screen.getByText('铁传甲'));

    expect(showDetail).toHaveBeenCalledTimes(1);
    expect(showDetail).toHaveBeenCalledWith('character', 'char_tie');
```

- [ ] **Step 4: Run the focused card tests**

Run from `dashboard/`:

```bash
rtk npm run test -- RelatedEntityListCard.test.tsx FactionCard.test.tsx
```

Expected:

```text
Test Files  2 passed (2)
Tests  3 passed (3)
```

- [ ] **Step 5: Run TypeScript and Vite build**

Run from `dashboard/`:

```bash
rtk npm run build
```

Expected: build exits 0. The existing Vite large-chunk warning may still appear.

- [ ] **Step 6: Commit FactionCard adoption**

Run from the repo root:

```bash
rtk git add dashboard/src/components/cards/FactionCard.tsx dashboard/src/components/cards/FactionCard.test.tsx
rtk git commit -m "refactor: share faction member list"
```

---

### Task 6: Final Verification

**Files:**
- Modify: none

- [ ] **Step 1: Run lint**

Run from `dashboard/`:

```bash
rtk npm run lint
```

Expected: exits 0.

- [ ] **Step 2: Run build**

Run from `dashboard/`:

```bash
rtk npm run build
```

Expected: exits 0. The existing Vite large-chunk warning may still appear.

- [ ] **Step 3: Run all dashboard tests**

Run from `dashboard/`:

```bash
rtk npm run test
```

Expected: all dashboard test files pass.

- [ ] **Step 4: Confirm only intended files changed**

Run from the repo root:

```bash
rtk git status --short --branch
```

Expected: on `codex/dashboard-related-list-card`, clean after the final commit.

Run from the repo root:

```bash
rtk git log --oneline -5
```

Expected: the top commits include:

```text
refactor: share faction member list
refactor: share skill related entity lists
refactor: share simple related entity lists
refactor: add related entity list card
```

## Decision Document

- `RelatedEntityListCard` is a rendering module, not a data lookup module.
- Card modules remain responsible for selecting store state and shaping entity rows.
- The shared interface accepts display-ready `items`, so it avoids depending on `Character`, `Skill`, `Item`, `Faction`, or `Location` types.
- `badge` is a `ReactNode` so callers can preserve existing role labels through `InkTag` without making the shared module know role semantics.
- `onSelect` receives only the row `id`; the caller still decides the target card type.
- Empty lists return `null`, matching the existing conditional card rendering.
- `limit` is included because related lists already use small visible subsets in nearby card code, and the test locks down the behavior.

## Testing Decisions

- The new module test is the main test surface for shared row rendering.
- `FactionCard.test.tsx` remains a card-level regression for role labels and now also verifies row navigation after migration.
- Build verification is required after each adoption commit because the refactor is mostly TypeScript wiring across React props.
- Full lint, build, and test verification is required before merging the branch.

## Self-Review

- Spec coverage: this plan creates the shared rendering module, adopts it in `ItemCard`, `LocationCard`, `SkillCard`, and `FactionCard`, preserves role labels, and leaves data shape unchanged.
- Placeholder scan: the plan contains no deferred implementation markers.
- Type consistency: `RelatedEntityListItem`, `title`, `items`, `limit`, and `onSelect` are defined in Task 2 and used consistently in later tasks.
