---
name: game-design-grill
description: >
  Grill the player relentlessly about a game design decision — mechanics, balance,
  level layout, narrative flow, UI flow. Adapted from mattpocock's grilling skill
  for game design. Use before implementing any new game feature.
disable-model-invocation: true
---

# Game Design Grilling

Interview the designer relentlessly about every aspect of a game feature
until we reach a shared understanding. Walk down each branch of the design
tree, resolving dependencies between decisions one-by-one.

## Focus areas

For each game feature, systematically explore:

### Mechanics
- What exactly does the player do? (Input → Response)
- What's the skill ceiling? Can a skilled player do it better?
- What prevents spamming / trivializing?
- How does this interact with other mechanics?

### Balance
- What numbers are involved? (Damage, duration, cooldown, cost)
- What's the failure mode? (Too weak = ignored, too strong = only strategy)
- Where's the tuning knob? (What variable changes balance?)

### Narrative (if applicable)
- How does this serve the story?
- What does the player learn / feel?
- What happens if the player ignores it?

### UI / Feedback
- How does the player know this exists?
- What feedback confirms the action happened?
- What feedback shows the result?

### Scope
- Is this a core mechanic or a spice mechanic?
- What's the minimum viable version?
- What can be cut without breaking the design?

## Process

1. Ask ONE question at a time. Wait for the answer before the next.
2. For each answer, recommend a decision — but let the designer override.
3. If a FACT can be found in the codebase (existing systems, constraints),
   look it up rather than asking.
4. Challenge fuzzy answers. "You said 'the player feels powerful' —
   what numeric value makes the difference between 'weak' and 'powerful'?"
5. Do not act on anything until the designer confirms the design is locked.

## Completion

The session is done when:
- Every branch of the decision tree is resolved
- The designer can describe the feature to another developer without ambiguity
- Edge cases are explicitly listed
