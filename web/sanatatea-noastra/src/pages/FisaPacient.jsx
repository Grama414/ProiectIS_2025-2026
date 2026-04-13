import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import api from '../api' // Noul nostru curier către backend
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowLeft, Heart, Thermometer, Activity, User, Phone, Mail, MapPin } from 'lucide-react'

function FisaPacient() {
  const { id } = useParams() // Acesta este _id-ul pacientului din MongoDB
  const navigate = useNavigate()
  const [pacient, setPacient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [recomandari, setRecomandari] = useState([])
  const [showFormRec, setShowFormRec] = useState(false)
  const [newRec, setNewRec] = useState({ tip: '', durata: '', indicatii: '' })
  const [datePuls, setDatePuls] = useState([])
  const [dateTemperatura, setDateTemperatura] = useState([])

  useEffect(() => {
    const incarcaDate = async () => {
      try {
        let datePacient = null;
        // 1. Cerem datele pacientului de la server
        const docSnap = await api.get(`/pacient-detalii/${id}`)
        if (docSnap.data) {
          datePacient = docSnap.data;
        }

        // 2. Cerem masuratorile pentru grafice
        const snapM = await api.get(`/masuratori/${id}`)
        if (snapM.data && snapM.data.length > 0) {
          const masuratori = snapM.data.sort((a, b) => {
            if(a.ora && b.ora) return a.ora.localeCompare(b.ora);
            return new Date(a.timestamp) - new Date(b.timestamp);
          })
          
          // Suprascriem valorile afișate cu cele mai recente măsurători de la senzor
          if (datePacient) {
            const ultima = masuratori[masuratori.length - 1];
            datePacient = {
              ...datePacient,
              puls: ultima.puls || ultima.puls_mediu || datePacient.puls,
              temperatura: ultima.temperatura || ultima.temperatura_medie || datePacient.temperatura
            };
          }
          
          setDatePuls(masuratori.map(m => ({ 
            ora: m.ora || new Date(m.timestamp).getHours() + ':00', 
            valoare: m.puls || m.puls_mediu 
          })))
          
          setDateTemperatura(masuratori.map(m => ({ 
            ora: m.ora || new Date(m.timestamp).getHours() + ':00', 
            valoare: m.temperatura || m.temperatura_medie 
          })))
        }

        if (datePacient) {
          setPacient(datePacient);
        }

        // 3. Cerem recomandarile de la medic
        const snapR = await api.get(`/recomandari/${id}`)
        if (snapR.data) {
          setRecomandari(snapR.data)
        }
        
      } catch (err) {
        console.error('Eroare la incarcarea fisei:', err)
      }
      setLoading(false)
    }
    
    incarcaDate()

    // Setăm un timer pentru a actualiza datele la fiecare 5 secunde (Live Update)
    const interval = setInterval(incarcaDate, 5000);
    return () => clearInterval(interval);
  }, [id])

  const handleEdit = () => {
    setFormData({
      nume: pacient.nume || '',
      prenume: pacient.prenume || '',
      varsta: pacient.varsta || '',
      cnp: pacient.cnp || '',
      telefon: pacient.telefon || '',
      email: pacient.email || '',
      strada: pacient.strada || '',
      oras: pacient.oras || '',
      judet: pacient.judet || '',
      profesie: pacient.profesie || '',
      istoricMedical: pacient.istoricMedical || '',
      alergii: pacient.alergii || '',
      consultatiiCardiologice: pacient.consultatiiCardiologice || '',
    })
    setEditMode(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Trimitem noile date catre backend pentru a actualiza MongoDB
      await api.put(`/pacienti/${id}`, formData)
      setPacient({ ...pacient, ...formData })
      setEditMode(false)
    } catch (err) {
      console.error('Eroare la salvare:', err)
      alert('Nu s-a putut salva. Verifica conexiunea la server.')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!window.confirm(`Ești sigur că vrei să ștergi pacientul ${pacient.prenume} ${pacient.nume}?`)) return
    try {
      // Cerem serverului sa stearga pacientul
      await api.delete(`/pacienti/${id}`)
      navigate('/medic')
    } catch (err) {
      console.error('Eroare la stergere:', err)
    }
  }

  const handleAddRecomandare = async () => {
    if (!newRec.tip || !newRec.durata) return
    try {
      const payload = {
        ...newRec,
        pacientId: id,
        medicUid: sessionStorage.getItem('uid'),
      }
      
      // Salvam recomandarea in MongoDB prin serverul Node.js
      const response = await api.post('/recomandari', payload)
      
      setRecomandari([...recomandari, response.data.recomandare])
      setNewRec({ tip: '', durata: '', indicatii: '' })
      setShowFormRec(false)
    } catch (err) {
      console.error('Eroare la adaugarea recomandarii:', err)
    }
  }
  const getStatusTemperatura = (temp) => {
    if (temp >= 38.5) return { label: 'Avertizare', color: 'bg-red-100 text-red-700 border-red-300' }
    if (temp >= 37.5) return { label: 'Monitorizare', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' }
    return null
  }


  if (loading) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-gray-500">Se încarcă...</p>
    </div>
  )

  if (!pacient) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-gray-500">Pacientul nu a fost găsit.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100">

      <div className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/medic')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
            <span className="text-sm">Înapoi</span>
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 rounded-full p-2">
              <User size={20} className="text-purple-600" />
            </div>
            <div>
              <h1 className="font-bold text-gray-800">{pacient.prenume} {pacient.nume}</h1>
              <p className="text-xs text-gray-500">{pacient.varsta} ani • CNP: {pacient.cnp}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <button onClick={() => setEditMode(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                Anulează
              </button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors">
                {saving ? 'Se salvează...' : 'Salvează'}
              </button>
            </>
          ) : (
            <>
              <button onClick={handleEdit} className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors">
                Editează
              </button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors">
                Șterge
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-6 grid grid-cols-3 gap-6">

        <div className="col-span-1 space-y-4">

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4">Date de Contact</h2>
            {editMode ? (
              <div className="space-y-3">
                {[
                  { label: 'Prenume', key: 'prenume' },
                  { label: 'Nume', key: 'nume' },
                  { label: 'Vârstă', key: 'varsta', type: 'number' },
                  { label: 'Telefon', key: 'telefon' },
                  { label: 'Email', key: 'email' },
                  { label: 'Stradă', key: 'strada' },
                  { label: 'Oraș', key: 'oras' },
                  { label: 'Județ', key: 'judet' },
                  { label: 'Profesie', key: 'profesie' },
                ].map(({ label, key, type = 'text' }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input
                      type={type}
                      value={formData[key] || ''}
                      onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-600">{pacient.telefon}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-600">{pacient.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-600">{pacient.strada}, {pacient.oras}, {pacient.judet}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4">Date Medicale</h2>
            {editMode ? (
              <div className="space-y-3">
                {[
                  { label: 'Istoric Medical', key: 'istoricMedical' },
                  { label: 'Alergii', key: 'alergii' },
                  { label: 'Consultații Cardiologice', key: 'consultatiiCardiologice' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <textarea
                      value={formData[key] || ''}
                      onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500 resize-none"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Istoric Medical</p>
                  <p className="text-sm text-gray-600">{pacient.istoricMedical || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Alergii</p>
                  {pacient.alergii
                    ? <span className="inline-block bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">{pacient.alergii}</span>
                    : <span className="text-sm text-gray-400">Nicio alergie înregistrată</span>
                  }
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Consultații</p>
                  <p className="text-sm text-gray-600">{pacient.consultatiiCardiologice || '—'}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4">Valori Curente</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Heart size={16} className="text-red-500" />
                  <span className="text-sm text-gray-600">Puls</span>
                </div>
                <span className="font-bold text-red-500">{pacient.puls} bpm</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-xl ${
                pacient.temperatura >= 38.5 ? 'bg-red-100' :
                pacient.temperatura >= 37.5 ? 'bg-yellow-50' : 'bg-orange-50'
              }`}>
                <div className="flex items-center gap-2">
                  <Thermometer size={16} className="text-orange-500" />
                  <span className="text-sm text-gray-600">Temperatură</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-orange-500">{pacient.temperatura}°C</span>
                  {getStatusTemperatura(pacient.temperatura) && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getStatusTemperatura(pacient.temperatura).color}`}>
                      {getStatusTemperatura(pacient.temperatura).label}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-purple-500" />
                  <span className="text-sm text-gray-600">ECG</span>
                </div>
                <span className="font-bold text-purple-500">{pacient.ecg}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-2 space-y-4">

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Heart size={18} className="text-red-500" />
              <h2 className="font-semibold text-gray-800">Evoluție Puls (astăzi)</h2>
            </div>
            <ResponsiveContainer width="100%" height={200}>
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
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dateTemperatura}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="ora" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[35, 39]} />
                <Tooltip />
                <Line type="monotone" dataKey="valoare" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} name="Temperatură (°C)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Recomandări Medic</h2>
              <button
                onClick={() => setShowFormRec(!showFormRec)}
                className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-xl transition-colors"
              >
                + Adaugă
              </button>
            </div>
            {showFormRec && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tip activitate</label>
                  <input type="text" placeholder="ex: Bicicletă, Alergat, Plimbare" value={newRec.tip} onChange={e => setNewRec({ ...newRec, tip: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Durată zilnică</label>
                  <input type="text" placeholder="ex: 30 min/zi" value={newRec.durata} onChange={e => setNewRec({ ...newRec, durata: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Indicații</label>
                  <input type="text" placeholder="ex: Ritm moderat, evitați pantele" value={newRec.indicatii} onChange={e => setNewRec({ ...newRec, indicatii: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddRecomandare} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded-xl transition-colors">Salvează</button>
                  <button onClick={() => setShowFormRec(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm py-2 rounded-xl transition-colors">Anulează</button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {recomandari.length > 0 ? recomandari.map((rec) => (
                <div key={rec._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{rec.tip}</p>
                    <p className="text-xs text-gray-500">{rec.indicatii}</p>
                  </div>
                  <span className="text-sm text-purple-600 font-medium">{rec.durata}</span>
                </div>
              )) : (
                <p className="text-sm text-gray-400 text-center">Nicio recomandare adăugată încă.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default FisaPacient