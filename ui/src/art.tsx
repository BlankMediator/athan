export function Logo({ size = 38 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect width="48" height="48" rx="14" fill="currentColor"/><path d="M24 8 29 16 38 14 36 23 41 29 32 32 29 41 23 36 14 38 16 29 8 24 16 19 14 10 23 12Z" stroke="#f4efd9" strokeWidth="1.3"/><path d="M24 16 32 24 24 32 16 24Z" stroke="#f4efd9" strokeWidth="1.2"/><circle cx="24" cy="24" r="2.5" fill="#dbbc7e"/></svg>;
}
export function Landscape() {
  return <svg viewBox="0 0 680 330" fill="none" className="landscape" aria-hidden="true">
    <defs><linearGradient id="land-one" x1="300" y1="95" x2="300" y2="330" gradientUnits="userSpaceOnUse"><stop stopColor="#658b79"/><stop offset="1" stopColor="#416b5b"/></linearGradient><linearGradient id="land-two" x1="420" y1="170" x2="430" y2="330" gradientUnits="userSpaceOnUse"><stop stopColor="#83a491"/><stop offset="1" stopColor="#648c78"/></linearGradient><linearGradient id="dome" x1="473" y1="175" x2="540" y2="296"><stop stopColor="#d1d5b6"/><stop offset="1" stopColor="#9cb89d"/></linearGradient></defs>
    <g stroke="#bed2b8" opacity=".16"><circle cx="453" cy="123" r="89"/><circle cx="453" cy="123" r="122"/><circle cx="453" cy="123" r="160"/><path d="M212 123H666M453-45V292" strokeDasharray="2 9"/></g>
    <circle cx="453" cy="123" r="38" fill="#d9c596"/><circle cx="453" cy="123" r="47" stroke="#d9c596" opacity=".12"/>
    <g fill="#dcd8b6" opacity=".55"><circle cx="215" cy="52" r="1.5"/><circle cx="344" cy="30" r="1"/><circle cx="594" cy="57" r="1.5"/><path d="m552 37 1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5-4.5-1.5 4.5-1.5Z"/><path d="m299 85 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/></g>
    <path d="M26 317C79 282 139 199 213 237 285 274 299 195 368 218 449 245 488 162 546 191 616 224 646 176 702 182V350H26Z" fill="url(#land-one)"/>
    <path d="M120 338C177 310 219 289 281 301 342 315 364 248 425 258 484 268 505 232 560 240 612 247 650 214 707 232V350Z" fill="url(#land-two)"/>
    <g fill="#9bb49a"><path d="M600 231V110H616V231Z"/><path d="m608 87 8 23H600Z"/><path d="M596 125H620V132H596Z"/><path d="M597 190H619V197H597Z"/><path d="M606 75H610V91H606Z"/></g>
    <g fill="url(#dome)"><path d="M447 233H564V311H447Z"/><path d="M453 233C453 210 468 193 484 183 496 176 504 165 506 160 510 172 517 177 529 184 548 195 558 210 558 233Z"/><path d="M503 149H508V172H503Z"/><path d="M406 272H450V312H406Z"/><path d="M410 272C410 257 422 251 427 243 433 252 445 257 445 272Z"/><path d="M559 273H598V312H559Z"/><path d="M562 273C562 260 573 255 578 247 584 256 594 261 594 273Z"/></g>
    <g fill="#416d5b" opacity=".55"><path d="M492 311V273Q506 251 520 273V311Z"/><path d="M462 276V256Q468 246 474 256V276Z"/><path d="M537 276V256Q543 246 549 256V276Z"/><path d="M423 297V283Q428 275 433 283V297Z"/><path d="M574 298V285Q579 276 584 285V298Z"/><path d="M605 151Q608 144 611 151V166H605Z"/></g>
    <path d="M0 351C114 291 187 339 272 310 359 281 417 335 493 318 578 299 628 292 698 317V360H0Z" fill="#315e4e"/>
    <g stroke="#8daa8b" opacity=".38"><path d="M649 318v-57m0 37 13-19m-13 9-14-17m14 34-12-12m12 0 9-16"/><path d="M376 317v-40m0 20 10-12m-10 6-8-11"/></g>
  </svg>;
}
export function Compass({ bearing, mini = false, heading = 0 }: { bearing: number; mini?: boolean; heading?: number | undefined }) {
  return <svg viewBox="0 0 400 400" className={`compass ${mini ? 'mini' : ''}`} role="img" aria-label={`Qibla ${bearing.toFixed(1)} degrees clockwise from north`}>
    <g transform={`rotate(${-heading} 200 200)`}><circle cx="200" cy="200" r="178" fill="var(--surface)" stroke="var(--border)"/><circle cx="200" cy="200" r="144" fill="none" stroke="var(--border)"/>
    {Array.from({ length: 72 }, (_, i) => <line key={i} x1="200" y1={i % 6 === 0 ? 36 : 42} x2="200" y2={i % 6 === 0 ? 49 : 48} transform={`rotate(${i * 5} 200 200)`} stroke={i % 6 === 0 ? 'var(--muted)' : 'var(--border)'} strokeWidth={i % 6 === 0 ? 1.4 : 1} />)}
    {[['N', 200, 84], ['E', 320, 204], ['S', 200, 324], ['W', 80, 204]].map(([label, x, y]) => <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill={label === 'N' ? 'var(--accent)' : 'var(--muted)'} fontSize="13" fontFamily="Manrope Variable">{label}</text>)}
    <circle cx="200" cy="200" r="105" fill="none" stroke="var(--border)" strokeDasharray="2 7"/><path d="M185 200h30M200 185v30" stroke="var(--border)"/>
    <g transform={`rotate(${bearing} 200 200)`}><path d="M200 69 188 211 200 199 212 211Z" fill="var(--accent)"/><path d="M200 309 190 213 200 202 210 213Z" fill="var(--compass-tail)"/><circle cx="200" cy="69" r="17" fill="var(--accent)"/><path d="m192 64 8-3 8 3v11h-16Z" fill="#eee8d0"/><path d="M192 68h16" stroke="var(--accent)" strokeWidth="2"/></g>
    <circle cx="200" cy="200" r="9" fill="var(--surface)" stroke="var(--accent)" strokeWidth="3"/></g>
  </svg>;
}
