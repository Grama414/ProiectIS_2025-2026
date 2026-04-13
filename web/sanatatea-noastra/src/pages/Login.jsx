import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Mail, Lock, Eye, EyeOff, User } from 'lucide-react'
import api from '../api' // IMPORTAM NOUL NOSTRU CURIER CATRE NODE.JS

function Login() {
  const [email, setEmail] = useState('')
  const [parola, setParola] = useState('')
  const [nume, setNume] = useState('')
  const [rol, setRol] = useState('medic')
  const [showParola, setShowParola] = useState(false)
  const [eroare, setEroare] = useState('')
  const [loading, setLoading] = useState(false)
  const [modRegistrare, setModRegistrare] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!email || !parola) { setEroare('Completează email-ul și parola.'); return }
    if (!email.includes('@')) { setEroare('Email-ul nu este valid.'); return }

    setLoading(true)
    setEroare('')

    try {
      // TRITEM CEREREA CATRE SERVERUL NODE.JS (Render -> MongoDB)
      const response = await api.post('/login', { 
        email: email, 
        parola: parola,
        rol_cerut: rol 
      });

      const date = response.data.utilizator;

      if (date.rol !== rol) {
        setEroare(`Acest cont este de tip "${date.rol}", nu "${rol}".`)
        setLoading(false)
        return
      }

      // Salvam in sesiune
      sessionStorage.setItem('autentificat', 'true')
      sessionStorage.setItem('rol', date.rol)
      sessionStorage.setItem('uid', date._id) // MongoDB foloseste _id
      sessionStorage.setItem('nume', date.nume)

      if (date.rol === 'medic') {
        navigate('/medic')
      } else if (date.rol === 'admin') {
        navigate('/admin')
      } else {
        try {
          await api.get(`/pacient-fisa/${date._id}`)
          sessionStorage.setItem('fisaConfigurata', 'true')
          navigate('/pacient')
        } catch {
          navigate('/configurare')
        }
      }

    } catch (err) {
      if (err.response && err.response.data) {
        setEroare(err.response.data.mesaj || 'Eroare la autentificare.')
      } else {
        setEroare('Nu ne-am putut conecta la server. ' + err.message)
      }
    }
    setLoading(false)
  }

  const handleRegistrare = async () => {
    if (!nume) { setEroare('Completează numele.'); return }
    if (!email || !parola) { setEroare('Completează email-ul și parola.'); return }
    if (!email.includes('@')) { setEroare('Email-ul nu este valid.'); return }
    if (parola.length < 6) { setEroare('Parola trebuie să aibă minim 6 caractere.'); return }

    setLoading(true)
    setEroare('')

    try {
      // TRITEM DATELE NOI CATRE SERVERUL NODE.JS PENTRU A FI SALVATE IN MONGODB
      const response = await api.post('/register', {
        nume: nume,
        email: email,
        parola: parola,
        rol: rol
      });

      const userCreat = response.data.utilizator;

      sessionStorage.setItem('autentificat', 'true')
      sessionStorage.setItem('rol', rol)
      sessionStorage.setItem('uid', userCreat._id) // _id generat de MongoDB
      sessionStorage.setItem('nume', nume)
      
      if (rol === 'medic') {
        navigate('/medic')
      } else if (rol === 'admin') {
        navigate('/admin')
      } else {
        navigate('/configurare')
      }

    } catch (err) {
      if (err.response && err.response.data) {
        setEroare(err.response.data.mesaj || 'Acest email este deja înregistrat.')
      } else {
        setEroare('Nu ne-am putut conecta la server. ' + err.message)
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">

        <div className="flex flex-col items-center mb-8">
          <div className="bg-purple-600 rounded-full p-4 mb-4">
            <Heart className="text-white" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Sănătatea Noastră</h1>
          <p className="text-gray-500 text-sm mt-1">
            {modRegistrare ? 'Creează un cont nou' : 'Clinica "Sănătatea Noastră"'}
          </p>
        </div>

        {/* Selector rol */}
        <div className="grid grid-cols-3 rounded-xl overflow-hidden border border-gray-200 mb-6">
          <button
            onClick={() => setRol('medic')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              rol === 'medic' ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            Medic
          </button>
          <button
            onClick={() => setRol('pacient')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              rol === 'pacient' ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            Pacient
          </button>
          <button
            onClick={() => setRol('admin')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              rol === 'admin' ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            Administrator
          </button>
        </div>

        {/* Camp nume - doar la registrare */}
        {modRegistrare && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nume complet</label>
            <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-blue-500">
              <User size={18} className="text-gray-400 mr-2" />
              <input
                type="text"
                placeholder="ex: Dr. Ionescu"
                value={nume}
                onChange={(e) => setNume(e.target.value)}
                className="flex-1 outline-none text-sm text-gray-700"
              />
            </div>
          </div>
        )}

        {/* Camp email */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-blue-500">
            <Mail size={18} className="text-gray-400 mr-2" />
            <input
              type="email"
              placeholder="exemplu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 outline-none text-sm text-gray-700"
            />
          </div>
        </div>

        {/* Camp parola */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Parolă</label>
          <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-blue-500">
            <Lock size={18} className="text-gray-400 mr-2" />
            <input
              type={showParola ? 'text' : 'password'}
              placeholder="••••••••"
              value={parola}
              onChange={(e) => setParola(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (modRegistrare ? handleRegistrare() : handleLogin())}
              className="flex-1 outline-none text-sm text-gray-700"
            />
            <button onClick={() => setShowParola(!showParola)}>
              {showParola ? <EyeOff size={18} className="text-gray-400" /> : <Eye size={18} className="text-gray-400" />}
            </button>
          </div>
        </div>

        {eroare && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{eroare}</p>
          </div>
        )}

        {/* Buton principal */}
        <button
          onClick={modRegistrare ? handleRegistrare : handleLogin}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {loading ? 'Se procesează...' : modRegistrare ? 'Creează cont' : 'Intră în cont'}
        </button>

        {/* Switch intre login si registrare */}
        <button
          onClick={() => { setModRegistrare(!modRegistrare); setEroare('') }}
          className="w-full mt-3 py-2 text-sm text-purple-600 hover:underline"
        >
          {modRegistrare ? 'Ai deja cont? Intră în cont' : 'Nu ai cont? Creează unul acum'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-4">
          © 2026 Clinica Sănătatea Noastră
        </p>
      </div>
    </div>
  )
}

export default Login