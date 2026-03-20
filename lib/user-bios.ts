// Fill in real-life facts about each player.
// Claude will use these to roast everyone in the weekly recap.
// Key = username from the users table.

export const USER_BIOS: Record<string, string> = {
  mj: `
- Fact 1 about Mike
- Fact 2 about Mike
- Fact 3 about Mike
`.trim(),

  pp: `
- Fact 1 about Phil
- Fact 2 about Phil
- Fact 3 about Phil
`.trim(),

  jc: `
- Fact 1 about John
- Fact 2 about John
- Fact 3 about John
`.trim(),

  jb: `
- Fact 1 about Justin
- Fact 2 about Justin
- Fact 3 about Justin
`.trim(),
};
