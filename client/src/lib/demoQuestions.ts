/**
 * 演示任务数据：仅用于浏览器预览与真实题库为空时的界面演示。
 * 明确标注为演示数据，不写入本地数据库，也不进入任何统计。
 */

export interface DemoTask {
  id: string;
  source: string;
  number: string;
  title: string;
  text: string;
  tags: string[];
  difficulty: string;
  points: number;
  status: string;
}

export const demoTasks: DemoTask[] = [
  {
    id: "E-2025-07b",
    source: "Euclid 2025",
    number: "第 7 题 (b)",
    title: "递推中的不变量",
    text: "设数列由给定递推式定义。证明所求表达式对所有正整数 n 均成立。",
    tags: ["数列", "递推", "证明"],
    difficulty: "中高",
    points: 4,
    status: "待作答",
  },
  {
    id: "POTM-26-04",
    source: "Problem of the Month",
    number: "April",
    title: "计数与不变量",
    text: "在满足给定约束的构造中，找出一个在操作下保持不变的量，并据此完成计数。",
    tags: ["计数", "不变量"],
    difficulty: "高",
    points: 10,
    status: "专项中",
  },
  {
    id: "E-2024-10",
    source: "Euclid 2024",
    number: "第 10 题",
    title: "几何构造的存在性",
    text: "在给定几何条件下证明所需构造存在，并说明其关键性质。",
    tags: ["几何", "构造", "高难"],
    difficulty: "最高",
    points: 10,
    status: "待复盘",
  },
];
