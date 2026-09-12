module.exports = {
  async up(q, S) {
    await q.changeColumn("Game", "rankingView", {
      type: S.STRING,
      defaultValue: "hidden",
    });
    await q.bulkUpdate("Game", { rankingView: "hidden" }, {});
  },
  async down(q, S) {
    await q.bulkUpdate("Game", { rankingView: "teams" }, {});
    await q.changeColumn("Game", "rankingView", {
      type: S.STRING,
      defaultValue: "teams",
    });
  },
};
