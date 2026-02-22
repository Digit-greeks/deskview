import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { BookProvider } from './contexts/BookContext'
import NavBar from './components/NavBar'
import BookPage from './pages/BookPage'
import SimulatorPage from './pages/SimulatorPage'

function App() {
  return (
    <BrowserRouter>
      <BookProvider>
        <div className="min-h-screen bg-[#131316] text-white">
          <NavBar />
          <Routes>
            <Route path="/" element={<BookPage />} />
            <Route path="/simulator" element={<SimulatorPage />} />
          </Routes>
        </div>
      </BookProvider>
    </BrowserRouter>
  )
}

export default App
