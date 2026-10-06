/** 従業員名簿の共通本文。PJ参加者を雇用社員と推定して転記しない。 */
export function ProjectEmployeeRegister() {
  return <div data-testid="project-employee-register" className="space-y-3 py-3">
    <h2 className="text-lg font-semibold leading-7">従業員名簿</h2>
    <p className="text-sm text-[#6e6e73]">資料未登録</p>
  </div>;
}
