module.exports = {
  async up(q, S) {
    const id = {
      type: S.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    };
    const text = { type: S.STRING(120), allowNull: false };
    const num = { type: S.INTEGER.UNSIGNED, allowNull: false };
    const fk = (table) => ({
      ...num,
      references: { model: table, key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
    await q.createTable("Teacher", {
      id,
      name: text,
      email: { ...text, unique: true },
      passwordHash: text,
    });
    await q.createTable("Game", {
      id,
      teacherId: fk("Teacher"),
      code: { ...text, unique: true },
      status: {
        type: S.ENUM(
          "LOBBY",
          "READY",
          "QUESTION_ACTIVE",
          "QUESTION_FINISHED",
          "SHOWING_RANKING",
          "FINISHED",
        ),
        allowNull: false,
        defaultValue: "LOBBY",
      },
      questionCount: num,
      questionDurationSeconds: num,
      currentQuestionIndex: {
        type: S.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      questionStartedAt: S.DATE(3),
      questionExpiresAt: S.DATE(3),
      startedAt: S.DATE(3),
      finishedAt: S.DATE(3),
      rankingView: { type: S.STRING, allowNull: false, defaultValue: "teams" },
    });
    await q.createTable("Player", {
      id,
      gameId: fk("Game"),
      name: text,
      avatar: text,
      sessionTokenHash: { ...text, unique: true },
    });
    await q.createTable("Team", {
      id,
      gameId: fk("Game"),
      name: text,
      leftPlayerId: fk("Player"),
      rightPlayerId: fk("Player"),
    });
    await q.createTable("TeamMember", {
      id,
      teamId: fk("Team"),
      playerId: { ...fk("Player"), unique: true },
      side: { type: S.ENUM("LEFT", "RIGHT"), allowNull: false },
    });
    await q.addConstraint("TeamMember", {
      fields: ["teamId", "side"],
      type: "unique",
      name: "unique_team_side",
    });
    await q.createTable("Question", {
      id,
      statement: { type: S.TEXT, allowNull: false },
      leftOption: text,
      rightOption: text,
      correctOption: { type: S.ENUM("LEFT", "RIGHT"), allowNull: false },
      explanation: { type: S.TEXT, allowNull: false },
      category: text,
      difficulty: text,
    });
    await q.createTable("GameQuestion", {
      id,
      gameId: fk("Game"),
      questionId: fk("Question"),
      position: num,
    });
    for (const field of ["position", "questionId"])
      await q.addConstraint("GameQuestion", {
        fields: ["gameId", field],
        type: "unique",
        name: "unique_game_" + field,
      });
    await q.createTable("TeamAnswer", {
      id,
      gameId: fk("Game"),
      gameQuestionId: fk("GameQuestion"),
      teamId: fk("Team"),
      answeredByPlayerId: fk("Player"),
      selectedOption: { type: S.ENUM("LEFT", "RIGHT"), allowNull: false },
      isCorrect: { type: S.BOOLEAN, allowNull: false },
      responseTimeMs: num,
      scoreAwarded: num,
      answeredAt: { type: S.DATE(3), allowNull: false },
    });
    await q.addConstraint("TeamAnswer", {
      fields: ["teamId", "gameQuestionId"],
      type: "unique",
      name: "unique_team_answer",
    });
    await q.createTable("PairRequest", {
      id,
      gameId: fk("Game"),
      requesterPlayerId: fk("Player"),
      targetPlayerId: fk("Player"),
      targetRelativePosition: {
        type: S.ENUM("LEFT", "RIGHT"),
        allowNull: false,
      },
      requestStatus: {
        type: S.STRING,
        allowNull: false,
        defaultValue: "PENDING",
      },
    });
  },
  async down(q) {
    for (const t of [
      "PairRequest",
      "TeamAnswer",
      "GameQuestion",
      "Question",
      "TeamMember",
      "Team",
      "Player",
      "Game",
      "Teacher",
    ])
      await q.dropTable(t);
  },
};
