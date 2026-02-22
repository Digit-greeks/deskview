import { NavLink } from 'react-router-dom'

export default function NavBar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-1.5 text-base font-medium rounded transition-colors ${
      isActive
        ? 'text-[#1677FF] bg-[#1677FF]/10'
        : 'text-gray-400 hover:text-white hover:bg-[#18181B]'
    }`

  return (
    <header className="bg-[#1a1a1f] border-b border-[#333340] sticky top-0 z-50">
      <div className="w-full lg:max-w-full mx-auto px-4 lg:px-8 flex items-center gap-8 h-20">
        <div className="flex items-center gap-3">
          <span className="text-[#1677FF] font-bold text-4xl tracking-wide font-mono">DeskView</span>
        </div>
        <nav className="flex items-center gap-1 ml-4">
          <NavLink to="/" end className={linkClass}>
            Book
          </NavLink>
          <NavLink to="/simulator" className={linkClass}>
            Simulator
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
