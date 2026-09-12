module.exports = {
  async up(q, S) {
    await q.addColumn("Question", "isActive", {
      type: S.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },
  async down(q) {
    await q.removeColumn("Question", "isActive");
  },
};
