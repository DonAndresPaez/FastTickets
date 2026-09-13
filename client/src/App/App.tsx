import { useState } from 'react'
// import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className="bg-[#333333] text-white flex items-center justify-center">
      <h1 className="text-3xl font-bold">Hello World</h1>
    </div>
    </>
  )
}

export default App
