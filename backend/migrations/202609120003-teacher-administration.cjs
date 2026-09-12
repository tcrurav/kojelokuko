module.exports = {
  async up(q, S) {
    await q.addColumn("Teacher", "role", {
      type: S.ENUM("teacher", "admin"),
      allowNull: false,
      defaultValue: "teacher",
    });
    // Existing teachers retain access; new registrations require activation.
    await q.addColumn("Teacher", "isActive", {
      type: S.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await q.changeColumn("Teacher", "isActive", {
      type: S.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await q.addColumn("Teacher", "sessionVersion", {
      type: S.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    });
    await q.addColumn("Teacher", "deletedAt", {
      type: S.DATE(3),
      allowNull: true,
    });
  },
  async down(q) {
    for (const column of ["deletedAt", "sessionVersion", "isActive", "role"])
      await q.removeColumn("Teacher", column);
  },
};
