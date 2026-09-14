module.exports = {
  async up(q, S) {
    await q.addColumn("Game", "showPartnerOption", {
      type: S.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },
  async down(q) {
    await q.removeColumn("Game", "showPartnerOption");
  },
};
