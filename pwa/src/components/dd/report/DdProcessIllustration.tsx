export type DdProcessIllustrationKind='collect'|'separate'|'analyse'|'deliver';
export function ddProcessIllustrationKind(title:string):DdProcessIllustrationKind|null{
  if(/抽出|分離/.test(title))return 'separate';
  if(/精製|分析|品質/.test(title))return 'analyse';
  if(/販売|出荷|再利用/.test(title))return 'deliver';
  if(/回収/.test(title))return 'collect';
  return null;
}
/** Small reusable process drawings; native SVG works in both the viewer and PDF. */
export function DdProcessIllustration({kind}:{kind:DdProcessIllustrationKind}){
  const labels={collect:'菌体を回収容器に集める',separate:'抽出した液と菌体を分離する',analyse:'試料の品質を測定する',deliver:'回収した金属原料を出荷・再利用する'};
  return <svg className="ddr-process-illustration" viewBox="0 0 88 64" role="img" aria-label={labels[kind]} fill="none" stroke="#19495e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {kind==='collect'&&<>
      <path d="M7 26h14m-5-5 5 5-5 5" stroke="#1194ad"/>
      <path d="M30 17h30v34c0 5-30 5-30 0V17Z" fill="#def1f5"/><ellipse cx="45" cy="17" rx="15" ry="5" fill="#fff"/>
      <path d="M31 24c8 4 20 4 28 0M32 47c7 3 19 3 26 0" stroke="#8cbac5"/>
      <path d="m39 32 5 3m7 1 4-3m-17 9 5 1" stroke="#22b6ca" strokeWidth="5"/>
      <circle cx="42" cy="32" r="1.8" fill="#f2a51a" stroke="none"/><circle cx="52" cy="36" r="1.8" fill="#f2a51a" stroke="none"/><circle cx="40" cy="42" r="1.8" fill="#f2a51a" stroke="none"/>
      <path d="M68 13v10m-4-4 4 4 4-4" stroke="#1194ad"/>
    </>}
    {kind==='separate'&&<>
      <path d="M13 14h25M17 14v36c0 6 17 6 17 0V14" fill="#fff"/><path d="M18 31h15v18c-4 3-11 3-15 0Z" fill="#c8ebf1" stroke="none"/>
      <path d="M18 44h15v5c-4 3-11 3-15 0Z" fill="#f4b645" stroke="none"/><path d="M20 23h4m-4 7h4m-4 7h4" stroke="#8aa9b5"/>
      <path d="M42 29h11m-4-4 4 4-4 4" stroke="#1194ad"/>
      <path d="M59 17h19L70 32v9m-7 0h14v12H63Z" fill="#fff"/>
      <path d="M63 47h14v6H63Z" fill="#f4b645" stroke="none"/>
      <circle cx="69" cy="23" r="1.7" fill="#f2a51a" stroke="none"/><circle cx="73" cy="22" r="1.7" fill="#f2a51a" stroke="none"/>
    </>}
    {kind==='analyse'&&<>
      <rect x="10" y="16" width="40" height="36" rx="3" fill="#fff"/><rect x="15" y="21" width="30" height="18" rx="1" fill="#e0f1f5" stroke="none"/>
      <path d="M19 34h4l3-9 4 11 4-7 3 5h4" stroke="#159bb4"/>
      <circle cx="19" cy="45" r="2" fill="#f2a51a" stroke="none"/><path d="M27 45h15" stroke="#8cb0bd"/>
      <path d="M61 27h13m-11 0v23c0 4 9 4 9 0V27" fill="#fff"/><path d="M64 39h7v11c-2 2-5 2-7 0Z" fill="#f4b645" stroke="none"/>
      <path d="m59 15 3 3 6-6" stroke="#1194ad" strokeWidth="2.5"/>
    </>}
    {kind==='deliver'&&<>
      <path d="m14 41 10-9h15l7 9-5 10H17Z" fill="#dde7eb"/><path d="m24 32 4 10h18M28 42l-3 9" stroke="#8aa6b2"/>
      <path d="m33 25 9-8h14l7 8-5 10H37Z" fill="#f6c875"/><path d="m42 17 4 9h17M46 26l-3 9" stroke="#b98028"/>
      <path d="M57 43h22v14H57Z" fill="#fff"/><path d="M57 43l6-6h10l6 6M68 43v14" stroke="#8aa6b2"/>
      <path d="M16 24a22 22 0 0 1 14-13m-5-2 5 2-2 5" stroke="#1194ad"/>
      <path d="M69 17a22 22 0 0 1 6 10m-5-3 5 3 3-4" stroke="#1194ad"/>
    </>}
  </svg>;
}
