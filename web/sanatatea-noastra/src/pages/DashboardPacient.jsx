import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api' // ÎNLOCUIM FIREBASE CU API-UL NOSTRU
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Heart, Thermometer, Activity, Bell, LogOut, User, CheckCircle } from 'lucide-react'

function DashboardPacient() {
  const [paginaActiva, setPaginaActiva] = useState('acasa')
  const [pacient, setPacient] = useState(null)
  const [recomandari, setRecomandari] = useState([])
  const [datePuls, setDatePuls] = useState([])
  const [dateTemperatura, setDateTemperatura] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const nume = sessionStorage.getItem('nume') || 'Pacient'
  const uid = sessionStorage.getItem('uid')

  useEffect(() => {
    const incarcaDate = async () => {
      try {
        // Cerem de la backend fisa medicala asociata acestui pacient (folosind uid-ul din sesiune)
        const responseFisa = await api.get(`/pacient-fisa/${uid}`)
        
        if (responseFisa.data) {
          let datePacient = responseFisa.data

          // Acum cerem masuratorile pentru ID-ul fisei (care in MongoDB e _id)
          const responseMasuratori = await api.get(`/masuratori/${datePacient._id}`)
          
          if (responseMasuratori.data && responseMasuratori.data.length > 0) {
             const masuratori = responseMasuratori.data; // Datele vin deja sortate de la backend
             
             // Extragem cea mai recentă măsurătoare pentru a actualiza cardurile din Acasă
             const ultima = masuratori[masuratori.length - 1];
             datePacient = {
               ...datePacient,
               puls: ultima.puls || ultima.puls_mediu || datePacient.puls,
               temperatura: ultima.temperatura || ultima.temperatura_medie || datePacient.temperatura
             };

             // Mapăm datele pentru Recharts
             setDatePuls(masuratori.map(m => ({ 
               ora: m.ora || new Date(m.timestamp).getHours() + ':00', 
               valoare: m.puls || m.puls_mediu // Acoperim ambele variante de nume ale proprietatii
             })))
             
             setDateTemperatura(masuratori.map(m => ({ 
               ora: m.ora || new Date(m.timestamp).getHours() + ':00', 
               valoare: m.temperatura || m.temperatura_medie 
             })))
          }
          
          setPacient(datePacient)

          const responseRecomandari = await api.get(`/recomandari/${datePacient._id}`)
          setRecomandari(responseRecomandari.data || [])
        }
      } catch (err) {
        // Ignoram eroarea daca pacientul nu si-a configurat inca fisa (CNP)
        if (err.response && err.response.status !== 404) {
          console.error('Eroare la incarcare date:', err)
        }
      }
      setLoading(false)
    }
    
    incarcaDate()

    // Setăm un timer pentru a actualiza datele la fiecare 5 secunde (Live Update)
    const interval = setInterval(incarcaDate, 5000);
    return () => clearInterval(interval);
  }, [uid])

  const prenumeScurt = nume.split(' ')[0]

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Header */}
      <div className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-purple-600 rounded-full p-2">
            <Heart className="text-white" size={20} />
          </div>
          <div>
            <p className="font-bold text-gray-800">Sănătatea Noastră</p>
            <p className="text-xs text-gray-500">Portal Pacient</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-purple-100 rounded-full p-2">
              <User size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{nume}</p>
              <p className="text-xs text-gray-500">Pacient</p>
            </div>
          </div>
          <button
            onClick={() => { sessionStorage.clear(); navigate('/') }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={16} />
            Ieșire
          </button>
        </div>
      </div>

      {/* Tab-uri */}
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="flex gap-1">
          {[
            { id: 'acasa', label: 'Acasă' },
            { id: 'valori', label: 'Valorile mele' },
            { id: 'recomandari', label: 'Recomandări' },
            { id: 'alarme', label: 'Alarme' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPaginaActiva(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                paginaActiva === tab.id
                  ? 'border-blue-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">

        {/* TAB ACASA */}
        {paginaActiva === 'acasa' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
              <p className="text-lg font-bold">Bună ziua, {prenumeScurt}! 👋</p>
              <p className="text-blue-100 text-sm mt-1">
                {loading ? 'Se încarcă datele...' : pacient ? 'Iată valorile tale de astăzi.' : 'Nu ai fost înregistrat de un medic încă.'}
              </p>
              {pacient && (
                <div className="flex gap-4 mt-4">
                  <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                    <p className="text-xl font-bold">{pacient.puls}</p>
                    <p className="text-xs text-blue-100">bpm</p>
                  </div>
                  <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                    <p className="text-xl font-bold">{pacient.temperatura}°</p>
                    <p className="text-xs text-blue-100">temp</p>
                  </div>
                  <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                    <p className="text-xl font-bold">{pacient.ecg}</p>
                    <p className="text-xs text-blue-100">ECG</p>
                  </div>
                </div>
              )}
            </div>

            {pacient ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-500">Puls</p>
                    <Heart size={18} className="text-red-400" />
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{pacient.puls} <span className="text-sm font-normal text-gray-500">bpm</span></p>
                  <p className="text-xs text-green-500 mt-1">✓ Normal</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-500">Temperatură</p>
                    <Thermometer size={18} className="text-orange-400" />
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{pacient.temperatura} <span className="text-sm font-normal text-gray-500">°C</span></p>
                  <p className="text-xs text-green-500 mt-1">✓ Normal</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-500">ECG</p>
                    <Activity size={18} className="text-blue-400" />
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{pacient.ecg}</p>
                  <p className="text-xs text-green-500 mt-1">✓ Ritm regulat</p>
                </div>
              </div>
            ) : !loading && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center">
                <p className="text-yellow-700 font-medium">Nu ai fost înregistrat de un medic încă.</p>
                <p className="text-yellow-600 text-sm mt-1">Contactează medicul tău pentru a fi adăugat în sistem.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB VALORILE MELE */}
        {paginaActiva === 'valori' && (
          <div className="space-y-4">
            {datePuls.length > 0 ? (
              <>
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Heart size={18} className="text-red-500" />
                    <h2 className="font-semibold text-gray-800">Evoluție Puls (astăzi)</h2>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={datePuls}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="ora" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={[60, 110]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="valoare" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Puls (bpm)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Thermometer size={18} className="text-orange-500" />
                    <h2 className="font-semibold text-gray-800">Evoluție Temperatură (astăzi)</h2>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dateTemperatura}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="ora" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={[35, 39]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="valoare" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} name="Temperatură (°C)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
                <p className="text-gray-500">Nu există măsurători disponibile încă.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB RECOMANDARI */}
        {paginaActiva === 'recomandari' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">Recomandările medicului</h2>
              {pacient && recomandari.length > 0 ? (
                <div className="space-y-3">
                  {recomandari.map((rec) => (
                    <div key={rec._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🏥</span>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{rec.tip} — {rec.durata}</p>
                          <p className="text-xs text-gray-500">{rec.indicatii}</p>
                        </div>
                      </div>
                      <CheckCircle size={20} className="text-green-500" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center">Nu există recomandări disponibile.</p>
              )}
            </div>
          </div>
        )}

        {/* TAB ALARME */}
        {paginaActiva === 'alarme' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Bell size={18} className="text-gray-600" />
                <h2 className="font-semibold text-gray-800">Istoric Alarme</h2>
              </div>
              <p className="text-gray-500 text-center text-sm">Nu există alarme înregistrate.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default DashboardPacient