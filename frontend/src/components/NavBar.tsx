import { NavLink } from 'react-router-dom'

export default function NavBar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-1.5 text-sm font-medium rounded transition-colors ${
      isActive
        ? 'text-[#f97316] bg-[#f97316]/10'
        : 'text-[#888] hover:text-white hover:bg-[#1e1e24]'
    }`

  return (
    <header className="bg-[#131316] border-b border-[#252530] sticky top-0 z-50">
      <div className="w-full px-6 flex items-center gap-6 h-12">
        <span className="text-white font-bold text-sm tracking-widest uppercase font-mono">
          Desk<span className="text-[#f97316]">View</span>
        </span>
        <div className="w-px h-4 bg-[#252530]" />
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>Book</NavLink>
          <NavLink to="/simulator" className={linkClass}>Simulator</NavLink>
        </nav>
      </div>
    </header>
  )
}
