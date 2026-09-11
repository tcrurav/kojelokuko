module.exports = {
  async up(q, S) {
    await q.addColumn("Question", "deletedAt", {
      type: S.DATE(3),
      allowNull: true,
      defaultValue: null,
    });
    await q.addColumn("Question", "version", {
      type: S.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    });
    await q.addColumn("GameQuestion", "questionSnapshot", {
      type: S.JSON,
      allowNull: true,
    });
    await q.sequelize
      .query(`UPDATE GameQuestion g JOIN Question q ON q.id = g.questionId
      SET g.questionSnapshot = JSON_OBJECT(
        'statement', q.statement, 'leftOption', q.leftOption, 'rightOption', q.rightOption,
        'correctOption', q.correctOption, 'explanation', q.explanation,
        'category', q.category, 'difficulty', q.difficulty)`);
    await q.changeColumn("GameQuestion", "questionSnapshot", {
      type: S.JSON,
      allowNull: false,
    });
  },
  async down(q) {
    await q.removeColumn("GameQuestion", "questionSnapshot");
    await q.removeColumn("Question", "version");
    await q.removeColumn("Question", "deletedAt");
  },
};
