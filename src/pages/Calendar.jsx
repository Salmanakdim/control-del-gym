import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Check, Dumbbell, X, ChevronLeft, ChevronRight, CheckSquare, CalendarDays,
         Clock, MapPin, Bell, AlignLeft, Users, ChevronDown, Search, Trash2, Edit2, Repeat } from 'lucide-react'
import { BottomSheet, CalendarPicker, TimePicker } from '../components/DateTimePicker'
import { scheduleReminder } from '../lib/notifications'

// ── Constants ────────────────────────────────────────────────────
const MONTHS_FULL  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic']
const DAYS_SHORT   = ['L','M','X','J','V','S','D']
const MAX_CHIPS    = 4
const HOUR_H       = 64   // px per hour

const EVENT_COLORS = [
  { label:'Azul',    value:'blue',   bg:'#2563eb' },
  { label:'Violeta', value:'violet', bg:'#7c3aed' },
  { label:'Verde',   value:'green',  bg:'#16a34a' },
  { label:'Rojo',    value:'red',    bg:'#dc2626' },
  { label:'Naranja', value:'orange', bg:'#ea580c' },
  { label:'Rosa',    value:'pink',   bg:'#db2777' },
]
const CHIP_COLORS = [
  { bg:'#dbeafe', text:'#1d4ed8' },
  { bg:'#ede9fe', text:'#6d28d9' },
  { bg:'#d1fae5', text:'#065f46' },
  { bg:'#fce7f3', text:'#9d174d' },
  { bg:'#ffedd5', text:'#c2410c' },
  { bg:'#cffafe', text:'#0e7490' },
  { bg:'#fef9c3', text:'#854d0e' },
]
const GYM_COLOR     = { bg:'#ede9fe', text:'#6d28d9' }
const NOTIF_OPTIONS = [
  { label:'5 minutos antes',  value:5  },
  { label:'15 minutos antes', value:15 },
  { label:'30 minutos antes', value:30 },
  { label:'1 hora antes',     value:60 },
  { label:'1 día antes',      value:1440 },
]
const RECURRENCE_OPTIONS = [
  { label:'No se repite', value:'none'    },
  { label:'Cada día',     value:'daily'   },
  { label:'Cada semana',  value:'weekly'  },
  { label:'Cada mes',     value:'monthly' },
  { label:'Cada año',     value:'yearly'  },
]
const EVENT_TYPES = ['Evento','Tarea']

// ── Helpers ──────────────────────────────────────────────────────
function toStr(d)         { return d.toISOString().split('T')[0] }
function isSameDay(a, b)  { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate() }
function timeToMin(t)     { if (!t) return 0; const [h,m]=t.split(':').map(Number); return h*60+m }
function colorBg(v)       { return EVENT_COLORS.find(c=>c.value===v)?.bg || '#2563eb' }
function fmtTime(h,m)     { return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` }
function snap15(min)      { return Math.round(min/15)*15 }
function titleColor(title) {
  let h=0; for (let i=0;i<title.length;i++) h=(h*31+title.charCodeAt(i))&0xffffffff
  return CHIP_COLORS[Math.abs(h)%CHIP_COLORS.length]
}

// ── Recurring ────────────────────────────────────────────────────
function expandRecurring(evs, rangeStart, rangeEnd) {
  const result = [...evs]
  for (const ev of evs) {
    if (!ev.recurrence || ev.recurrence==='none') continue
    const d = new Date(ev.date+'T00:00:00')
    for (let i=1;i<500;i++) {
      const nd = new Date(d)
      if      (ev.recurrence==='daily')   nd.setDate(d.getDate()+i)
      else if (ev.recurrence==='weekly')  nd.setDate(d.getDate()+i*7)
      else if (ev.recurrence==='monthly') nd.setMonth(d.getMonth()+i)
      else if (ev.recurrence==='yearly')  nd.setFullYear(d.getFullYear()+i)
      if (nd>rangeEnd) break
      if (nd>=rangeStart) result.push({...ev, id:`${ev.id}_r${i}`, date:toStr(nd), _virtual:true})
    }
  }
  return result
}

function emptyForm() {
  return { title:'', type:'Evento', allDay:false, startH:9, startM:0, endH:10, endM:0, location:'', notif:30, color:'blue', desc:'', recurrence:'none' }
}

// ── Overlap column layout (like Google Calendar) ─────────────────
// Returns each event enriched with _col (0-based) and _totalCols
function layoutEvents(evs) {
  if (!evs.length) return []
  const sorted = [...evs].sort((a,b) => timeToMin(a.time) - timeToMin(b.time))
  const placed = []

  for (const ev of sorted) {
    const start = timeToMin(ev.time)
    const end   = ev.endTime ? timeToMin(ev.endTime) : start + 60
    // find column slots occupied by overlapping events
    const usedCols = new Set(
      placed.filter(p => p.start < end && p.end > start).map(p => p.col)
    )
    let col = 0
    while (usedCols.has(col)) col++
    placed.push({ ev, col, start, end })
  }

  // compute totalCols per event = max col+1 among all events that overlap with it
  return placed.map(p => {
    const overlapping = placed.filter(q => q.start < p.end && q.end > p.start)
    const totalCols   = Math.max(...overlapping.map(q => q.col + 1))
    return { ...p.ev, _col: p.col, _totalCols: totalCols }
  })
}

// ── Component ────────────────────────────────────────────────────
export default function Calendar({ logs }) {
  const { user } = useAuth()
  const nowRef = useRef(new Date()); nowRef.current.setHours(0,0,0,0)
  const now = nowRef.current

  const [view, setView]               = useState('month')
  const [currentMonth, setCurrentMonth] = useState(() => { const d=new Date();d.setDate(1);d.setHours(0,0,0,0);return d })
  const [selectedDay, setSelectedDay] = useState(null)
  const [tasks, setTasks]             = useState([])
  const [events, setEvents]           = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch]   = useState(false)

  const [showFabMenu, setShowFabMenu]         = useState(false)
  const [showAddTask, setShowAddTask]         = useState(false)
  const [showAddEvent, setShowAddEvent]       = useState(false)
  const [editingEvent, setEditingEvent]       = useState(null)
  const [addDate, setAddDate]                 = useState(null)
  const [newTitle, setNewTitle]               = useState('')
  const [form, setForm]                       = useState(emptyForm())
  const [evDateView, setEvDateView]           = useState('main')
  const [evShowColorPicker, setEvShowColorPicker] = useState(false)

  const [taskFolders, setTaskFolders]         = useState([])
  const [taskFolderId, setTaskFolderId]       = useState(null)
  const [showNewList, setShowNewList]         = useState(false)
  const [newListName, setNewListName]         = useState('')

  // ── Drag-to-create state ──────────────────────────────────────────
  const [creating, setCreating]   = useState(null)   // { startMin, endMin }
  const creatingRef               = useRef(null)
  // ── Drag-to-move state ────────────────────────────────────────────
  const [dragging, setDragging]   = useState(null)   // { ev, dur, offsetMin, currentStartMin }
  const draggingRef               = useRef(null)
  const timedItemsRef             = useRef([])       // kept in sync each render
  const updateEventTimeRef        = useRef(null)     // stable ref to async fn
  //
  const selectedDayRef            = useRef(selectedDay)
  const gridRef                   = useRef(null)
  const monthStripRef             = useRef(null)
  const dayViewRef                = useRef(null)

  useEffect(() => { selectedDayRef.current = selectedDay }, [selectedDay])
  useEffect(() => {
    loadTasks(); loadEvents()
    supabase.from('folders').select('id,name,color').eq('user_id',user.id).order('position')
      .then(({data})=>setTaskFolders(data||[]))
  }, [])

  // Auto-scroll day view
  useEffect(() => {
    if (view==='day' && dayViewRef.current) {
      const hour = selectedDay && isSameDay(selectedDay,now) ? Math.max(0,new Date().getHours()-1) : 7
      dayViewRef.current.scrollTop = hour * HOUR_H
    }
  }, [view, selectedDay])

  // ── Touch/mouse listeners: drag-to-create + drag-to-move ──────────
  useEffect(() => {
    const grid = gridRef.current
    if (!grid || view!=='day') return

    let longPressTimer  = null
    let longPressStartY = 0

    function yToMin(clientY) {
      const rect = grid.getBoundingClientRect()
      return Math.min(24*60-15, Math.max(0, (clientY - rect.top) / HOUR_H * 60))
    }

    // ── CREATE (touch/drag on empty area) ─────────────────────────────
    function startCreate(clientY) {
      const startMin = snap15(yToMin(clientY))
      const val = { startMin, endMin: startMin+15 }
      creatingRef.current = val
      setCreating({...val})
    }
    function moveCreate(clientY) {
      if (!creatingRef.current) return
      const endMin = Math.max(creatingRef.current.startMin+15, snap15(yToMin(clientY)))
      const val = {...creatingRef.current, endMin}
      creatingRef.current = val
      setCreating({...val})
    }
    function endCreate() {
      if (!creatingRef.current) return
      const { startMin, endMin } = creatingRef.current
      creatingRef.current = null
      setCreating(null)
      const f = emptyForm()
      f.startH=Math.floor(startMin/60); f.startM=startMin%60
      f.endH=Math.floor(endMin/60);     f.endM=endMin%60
      setForm(f); setAddDate(selectedDayRef.current)
      setEditingEvent(null); setEvDateView('main'); setEvShowColorPicker(false)
      setShowAddEvent(true)
    }

    // ── MOVE (long-press + drag on existing event) ────────────────────
    function startDrag(evId, clientY) {
      const ev = timedItemsRef.current.find(e => e.raw?.id === evId)
      if (!ev || ev.raw?._virtual) return
      const startMin = timeToMin(ev.time)
      const endMin   = ev.endTime ? timeToMin(ev.endTime) : startMin+60
      const dur      = endMin - startMin
      const touchMin = yToMin(clientY)
      const offsetMin = Math.max(0, Math.min(dur-15, touchMin - startMin))
      const val = { ev, dur, offsetMin, currentStartMin: startMin }
      draggingRef.current = val
      setDragging({...val})
      try { navigator.vibrate?.(40) } catch(_) {}
    }
    function moveDrag(clientY) {
      if (!draggingRef.current) return
      const { dur, offsetMin } = draggingRef.current
      const newStart = Math.max(0, Math.min(24*60-dur, snap15(yToMin(clientY) - offsetMin)))
      const val = {...draggingRef.current, currentStartMin: newStart}
      draggingRef.current = val
      setDragging({...val})
    }
    function endDrag() {
      if (!draggingRef.current) return
      const { ev, dur, currentStartMin } = draggingRef.current
      draggingRef.current = null
      setDragging(null)
      updateEventTimeRef.current?.(ev.raw, currentStartMin, currentStartMin+dur)
    }

    // ── Unified handlers ──────────────────────────────────────────────
    const onTouchStart = (e) => {
      const evEl = e.target.closest('[data-ev]')
      if (evEl?.dataset?.evid) {
        // potential long-press on event
        longPressStartY = e.touches[0].clientY
        const evId = evEl.dataset.evid
        const cy   = e.touches[0].clientY
        longPressTimer = setTimeout(() => {
          longPressTimer = null
          startDrag(evId, cy)
        }, 380)
        // do NOT prevent default yet — let scroll happen if user moves
      } else {
        e.preventDefault()
        startCreate(e.touches[0].clientY)
      }
    }

    const onTouchMove = (e) => {
      const cy = e.touches[0].clientY
      if (longPressTimer) {
        // cancel long-press if user scrolls (moved >12px)
        if (Math.abs(cy - longPressStartY) > 12) {
          clearTimeout(longPressTimer); longPressTimer = null
        }
        return
      }
      if (draggingRef.current) { e.preventDefault(); moveDrag(cy); return }
      if (creatingRef.current) { e.preventDefault(); moveCreate(cy) }
    }

    const onTouchEnd = () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
      if (draggingRef.current) { endDrag(); return }
      if (creatingRef.current) { endCreate() }
    }

    const onMouseDown = (e) => {
      const evEl = e.target.closest('[data-ev]')
      if (evEl?.dataset?.evid) {
        longPressStartY = e.clientY
        const evId = evEl.dataset.evid
        const cy   = e.clientY
        longPressTimer = setTimeout(() => { longPressTimer = null; startDrag(evId, cy) }, 300)
      } else {
        startCreate(e.clientY)
      }
    }
    const onMouseMove = (e) => {
      if (longPressTimer && Math.abs(e.clientY - longPressStartY) > 8) {
        clearTimeout(longPressTimer); longPressTimer = null
      }
      if (draggingRef.current) { moveDrag(e.clientY); return }
      if (creatingRef.current) { moveCreate(e.clientY) }
    }
    const onMouseUp = () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
      if (draggingRef.current) { endDrag(); return }
      if (creatingRef.current) { endCreate() }
    }

    grid.addEventListener('touchstart', onTouchStart, { passive:false })
    grid.addEventListener('touchmove',  onTouchMove,  { passive:false })
    grid.addEventListener('touchend',   onTouchEnd)
    grid.addEventListener('mousedown',  onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)

    return () => {
      grid.removeEventListener('touchstart', onTouchStart)
      grid.removeEventListener('touchmove',  onTouchMove)
      grid.removeEventListener('touchend',   onTouchEnd)
      grid.removeEventListener('mousedown',  onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
    }
  }, [view])

  // ── Data ─────────────────────────────────────────────────────────
  async function loadTasks() {
    const { data } = await supabase.from('tasks').select('id,title,completed,due_date,important')
      .eq('user_id',user.id).not('due_date','is',null).order('due_date')
    setTasks(data||[])
  }
  async function loadEvents() {
    const { data } = await supabase.from('calendar_events').select('*').eq('user_id',user.id).order('date')
    setEvents(data||[])
  }

  async function updateEventTime(rawEv, newStartMin, newEndMin) {
    const newStart = fmtTime(Math.floor(newStartMin/60), newStartMin%60)
    const newEnd   = fmtTime(Math.floor(newEndMin/60),   newEndMin%60)
    const { data, error } = await supabase.from('calendar_events')
      .update({ start_time: newStart, end_time: newEnd })
      .eq('id', rawEv.id).select().single()
    if (!error && data) setEvents(p => p.map(e => e.id===rawEv.id ? data : e))
  }
  // Keep a stable ref so the touch handler (closed over view) can call it
  updateEventTimeRef.current = updateEventTime

  // ── Navigation ───────────────────────────────────────────────────
  function goToToday() {
    const d=new Date();d.setHours(0,0,0,0)
    setCurrentMonth(new Date(d.getFullYear(),d.getMonth(),1))
    setSelectedDay(new Date(d)); setView('day')
  }
  function openDay(date) {
    setSelectedDay(new Date(date))
    setCurrentMonth(new Date(date.getFullYear(),date.getMonth(),1))
    setView('day')
  }
  function prevDay() { if(!selectedDay)return; const d=new Date(selectedDay);d.setDate(d.getDate()-1);openDay(d) }
  function nextDay() { if(!selectedDay)return; const d=new Date(selectedDay);d.setDate(d.getDate()+1);openDay(d) }

  const CAL_FOLDER_COLORS = { blue:'#3b82f6', purple:'#a855f7', green:'#22c55e', red:'#ef4444', orange:'#f97316', pink:'#ec4899', teal:'#14b8a6', amber:'#f59e0b' }
  function calFolderColor(c) { return CAL_FOLDER_COLORS[c]||'#64748b' }

  // ── Tasks ────────────────────────────────────────────────────────
  async function addTask() {
    if(!newTitle.trim()||!addDate) return
    let fid = taskFolderId
    if(showNewList && newListName.trim()) {
      const {data:nf}=await supabase.from('folders').insert({
        user_id:user.id,name:newListName.trim(),color:'blue',position:taskFolders.length
      }).select().single()
      if(nf){setTaskFolders(p=>[...p,nf]);fid=nf.id}
    }
    if(!fid) return  // require a list
    const {data}=await supabase.from('tasks').insert({
      user_id:user.id,title:newTitle.trim(),due_date:toStr(addDate),completed:false,folder_id:fid
    }).select().single()
    if(data) setTasks(p=>[...p,data])
    setNewTitle(''); setTaskFolderId(null); setShowNewList(false); setNewListName(''); setShowAddTask(false)
  }
  async function toggleTask(task) {
    await supabase.from('tasks').update({completed:!task.completed}).eq('id',task.id)
    setTasks(p=>p.map(t=>t.id===task.id?{...t,completed:!t.completed}:t))
  }
  async function deleteTask(task) {
    await supabase.from('tasks').delete().eq('id',task.id)
    setTasks(p=>p.filter(t=>t.id!==task.id))
  }

  // ── Events ───────────────────────────────────────────────────────
  function openNewEvent(date, startH) {
    const f=emptyForm()
    if(startH!==undefined){f.startH=startH;f.endH=Math.min(23,startH+1)}
    setAddDate(date||now); setForm(f); setEditingEvent(null)
    setEvDateView('main'); setEvShowColorPicker(false)
    setShowAddEvent(true); setShowFabMenu(false)
  }
  function openEditEvent(ev) {
    const [sh,sm]=(ev.start_time||'09:00').split(':').map(Number)
    const [eh,em]=(ev.end_time||'10:00').split(':').map(Number)
    setAddDate(new Date(ev.date+'T00:00:00'))
    setForm({title:ev.title,type:ev.type||'Evento',allDay:ev.all_day||false,startH:sh,startM:sm,endH:eh,endM:em,
      location:ev.location||'',notif:ev.notification_min||30,color:ev.color||'blue',desc:ev.description||'',recurrence:ev.recurrence||'none'})
    setEditingEvent(ev); setEvDateView('main'); setEvShowColorPicker(false); setShowAddEvent(true)
  }

  async function saveEvent() {
    if(!form.title.trim()||!addDate) return
    const payload={
      user_id:user.id, title:form.title.trim(), date:toStr(addDate),
      start_time:form.allDay?null:fmtTime(form.startH,form.startM),
      end_time:  form.allDay?null:fmtTime(form.endH,form.endM),
      type:form.type, all_day:form.allDay, location:form.location||null,
      notification_min:form.notif, color:form.color, description:form.desc||null, recurrence:form.recurrence,
    }
    if(editingEvent&&!editingEvent._virtual) {
      const {data,error}=await supabase.from('calendar_events').update(payload).eq('id',editingEvent.id).select().single()
      if(error){console.error(error);return}
      if(data) setEvents(p=>p.map(e=>e.id===editingEvent.id?data:e))
    } else {
      const {data,error}=await supabase.from('calendar_events').insert(payload).select().single()
      if(error){console.error(error);return}
      if(data){
        setEvents(p=>[...p,data])
        if(data.start_time&&form.notif){
          const [h,m]=data.start_time.split(':').map(Number)
          const dt=new Date(data.date+'T00:00:00');dt.setHours(h,m,0,0)
          dt.setMinutes(dt.getMinutes()-form.notif)
          if(dt>new Date()) scheduleReminder({id:data.id,title:data.title,reminder:dt.toISOString()}).catch(()=>{})
        }
      }
    }
    setShowAddEvent(false)
  }

  async function deleteEvent(ev) {
    if(ev._virtual) return
    await supabase.from('calendar_events').delete().eq('id',ev.id)
    setEvents(p=>p.filter(e=>e.id!==ev.id))
    setShowAddEvent(false)
  }

  // ── Computed ─────────────────────────────────────────────────────
  const year  = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const rangeStart = new Date(year,month-1,1)
  const rangeEnd   = new Date(year,month+3,0)
  const expandedEvents = expandRecurring(events, rangeStart, rangeEnd)

  function eventsForDay(date) {
    if(!date) return []
    const s=toStr(date)
    return [
      ...logs.filter(l=>l.date===s).map(w=>({id:'g'+w.id,label:w.routineName||'Entreno',type:'gym',completed:false})),
      ...expandedEvents.filter(e=>e.date===s).map(e=>({id:'e'+e.id,label:e.title,type:'event',completed:false,time:e.start_time,endTime:e.end_time,color:e.color,raw:e})),
      ...tasks.filter(t=>t.due_date===s).map(t=>({id:t.id,label:t.title,type:'task',completed:t.completed,task:t})),
    ]
  }

  function buildGrid(y,m) {
    const first=new Date(y,m,1);const last=new Date(y,m+1,0)
    let dow=first.getDay();if(dow===0)dow=7;dow--
    const cells=Array(dow).fill(null)
    for(let d=1;d<=last.getDate();d++) cells.push(new Date(y,m,d))
    while(cells.length%7!==0) cells.push(null)
    return cells
  }
  const grid=buildGrid(year,month)

  function mondayOfWeek(d) {
    const nd=new Date(d);const dow=nd.getDay();nd.setDate(nd.getDate()-(dow===0?6:dow-1));nd.setHours(0,0,0,0);return nd
  }
  const weekStart = selectedDay ? mondayOfWeek(selectedDay) : mondayOfWeek(now)
  const weekDays  = Array.from({length:7},(_,i)=>{ const d=new Date(weekStart);d.setDate(weekStart.getDate()+i);return d })
  const stripMonths = Array.from({length:12},(_,i)=>new Date(year,i,1))

  const q = searchQuery.toLowerCase()
  const searchResults = q.length>1 ? [
    ...tasks.filter(t=>t.title.toLowerCase().includes(q)).map(t=>({type:'task',label:t.title,date:t.due_date})),
    ...events.filter(e=>e.title.toLowerCase().includes(q)).map(e=>({type:'event',label:e.title,date:e.date})),
  ].sort((a,b)=>(a.date||'').localeCompare(b.date||'')) : []

  const selDayItems = selectedDay ? eventsForDay(selectedDay) : []
  const timedItems  = selDayItems.filter(e=>e.time)
  timedItemsRef.current = timedItems   // keep ref in sync for touch handlers
  const allDayItems = selDayItems.filter(e=>!e.time)
  const nowMin      = new Date().getHours()*60+new Date().getMinutes()

  // ── Ghost block render helper ─────────────────────────────────────
  function GhostBlock() {
    if (!creating) return null
    const { startMin, endMin } = creating
    const dur     = endMin - startMin
    const topPx   = (startMin/60)*HOUR_H
    const heightPx= Math.max(HOUR_H/4, (dur/60)*HOUR_H)
    const sH=Math.floor(startMin/60), sM=startMin%60
    const eH=Math.floor(endMin/60),   eM=endMin%60
    const isShort = heightPx < 30   // 15 min block

    return (
      <div style={{
        position:'absolute', top:topPx, left:4, right:4, height:heightPx,
        background:'rgba(37,99,235,0.1)',
        border:'2px solid #2563eb',
        borderRadius:8, zIndex:20, pointerEvents:'none',
        display:'flex', flexDirection:'column', overflow:'hidden', userSelect:'none',
      }}>
        {isShort ? (
          /* 15 min: squeeze everything in one line */
          <div style={{padding:'1px 6px', flex:1, display:'flex', alignItems:'center'}}>
            <span style={{fontSize:9,fontWeight:700,color:'#1d4ed8',whiteSpace:'nowrap',lineHeight:1}}>
              {fmtTime(sH,sM)} – {fmtTime(eH,eM)}
            </span>
          </div>
        ) : (
          <>
            <div style={{padding:'4px 8px', flex:1}}>
              {/* Time range always visible */}
              <p style={{fontSize:11,fontWeight:700,color:'#1d4ed8',lineHeight:1.3,margin:0}}>
                {fmtTime(sH,sM)} – {fmtTime(eH,eM)}
              </p>
              {/* Duration label at 30 min+ */}
              {dur>=30 && (
                <p style={{fontSize:10,color:'#3b82f6',margin:0,marginTop:2}}>{dur} min</p>
              )}
            </div>
            {/* Bottom drag handle */}
            <div style={{display:'flex',justifyContent:'center',paddingBottom:4,paddingTop:2}}>
              <div style={{width:28,height:4,borderRadius:2,background:'#2563eb',opacity:0.5}}/>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="pb-24 -mx-4 lg:-mx-8">

      {/* ── FAB menu ── */}
      {showFabMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-6 bg-black/30" onClick={()=>setShowFabMenu(false)}>
          <div className="flex flex-col items-end gap-3 mb-16" onClick={e=>e.stopPropagation()}>
            <button onClick={()=>{setShowFabMenu(false);setAddDate(addDate||now);setNewTitle('');setShowAddTask(true)}}
              className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-xl active:bg-slate-50">
              <span className="text-sm font-semibold text-slate-700">Nueva tarea</span>
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center"><CheckSquare size={18} className="text-white"/></div>
            </button>
            <button onClick={()=>openNewEvent(addDate||now)}
              className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-xl active:bg-slate-50">
              <span className="text-sm font-semibold text-slate-700">Nuevo evento</span>
              <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center"><CalendarDays size={18} className="text-white"/></div>
            </button>
          </div>
        </div>
      )}

      {/* ── Nueva tarea ── */}
      {showAddTask && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/40"
          onClick={()=>{setShowAddTask(false);setTaskFolderId(null);setShowNewList(false);setNewListName('')}}>
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0"><CheckSquare size={18} className="text-blue-600"/></div>
              <div>
                <h3 className="font-bold text-slate-800 leading-tight">Nueva tarea</h3>
                <p className="text-slate-400 text-xs capitalize">{addDate?.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</p>
              </div>
            </div>

            {/* Title */}
            <input autoFocus value={newTitle} onChange={e=>setNewTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()}
              placeholder="Nombre de la tarea..."
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"/>

            {/* List selector (required) */}
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Lista <span className="text-red-400">*</span></p>
            {!showNewList ? (
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto mb-4">
                {taskFolders.map(f=>(
                  <button key={f.id} onClick={()=>setTaskFolderId(f.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-semibold text-left transition-colors
                      ${taskFolderId===f.id?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:calFolderColor(f.color)}}/>
                    {f.name}
                  </button>
                ))}
                <button onClick={()=>setShowNewList(true)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-slate-200 text-sm font-semibold text-slate-400 hover:bg-slate-50">
                  <Plus size={13}/> Nueva lista…
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-4">
                <input value={newListName} onChange={e=>setNewListName(e.target.value)} autoFocus
                  placeholder="Nombre de la nueva lista..."
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                <button onClick={()=>{setShowNewList(false);setNewListName('')}}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 flex-shrink-0">
                  <X size={15} className="text-slate-500"/>
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={()=>{setShowAddTask(false);setTaskFolderId(null);setShowNewList(false);setNewListName('')}}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl text-sm">Cancelar</button>
              <button onClick={addTask}
                disabled={!newTitle.trim()||(!taskFolderId&&!(showNewList&&newListName.trim()))}
                className={`flex-1 py-3 font-bold rounded-xl text-sm transition-colors
                  ${newTitle.trim()&&(taskFolderId||(showNewList&&newListName.trim()))?'bg-blue-600 text-white':'bg-slate-200 text-slate-400'}`}>
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Evento form ── */}
      {showAddEvent && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <button onClick={()=>setShowAddEvent(false)} className="text-blue-600 font-semibold text-sm">Cancelar</button>
            <div className="w-10 h-1 bg-slate-200 rounded-full"/>
            <button onClick={saveEvent} className="text-blue-600 font-bold text-sm">Guardar</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <input autoFocus value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                placeholder="Añade un título" className="w-full text-2xl text-slate-700 placeholder-slate-300 focus:outline-none font-light"/>
            </div>
            <div className="px-5 py-3 flex gap-2 border-b border-slate-100">
              {EVENT_TYPES.map(t=>(
                <button key={t} onClick={()=>setForm(f=>({...f,type:t}))}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors
                    ${form.type===t?'bg-blue-100 text-blue-700 border-blue-300':'bg-white text-slate-600 border-slate-200'}`}>{t}</button>
              ))}
            </div>
            <div className="border-b border-slate-100">
              <div className="flex items-center gap-4 px-5 py-3.5">
                <Clock size={20} className="text-slate-400 flex-shrink-0"/>
                <span className="text-slate-700 text-sm flex-1">Todo el día</span>
                <button onClick={()=>setForm(f=>({...f,allDay:!f.allDay}))}
                  style={{width:48,height:28,borderRadius:14,border:'none',cursor:'pointer',background:form.allDay?'#3b82f6':'#d1d5db',position:'relative',flexShrink:0,transition:'background 0.2s'}}>
                  <span style={{position:'absolute',top:3,left:form.allDay?23:3,width:22,height:22,borderRadius:'50%',background:'white',boxShadow:'0 1px 3px rgba(0,0,0,0.2)',transition:'left 0.2s'}}/>
                </button>
              </div>
              <button onClick={()=>setEvDateView('start-cal')} className="w-full flex items-center px-5 py-3 pl-14 active:bg-slate-50">
                <span className="text-slate-700 text-sm flex-1 text-left capitalize">{addDate?.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'short'})}</span>
                {!form.allDay && <span className="text-blue-600 text-sm font-medium">{fmtTime(form.startH,form.startM)}</span>}
              </button>
              <button onClick={()=>setEvDateView('end-cal')} className="w-full flex items-center px-5 py-3 pl-14 border-t border-slate-50 active:bg-slate-50">
                <span className="text-slate-700 text-sm flex-1 text-left capitalize">{addDate?.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'short'})}</span>
                {!form.allDay && <span className="text-blue-600 text-sm font-medium">{fmtTime(form.endH,form.endM)}</span>}
              </button>
            </div>
            <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
              <Repeat size={20} className="text-slate-400 flex-shrink-0"/>
              <select value={form.recurrence} onChange={e=>setForm(f=>({...f,recurrence:e.target.value}))}
                className="flex-1 text-sm text-slate-700 focus:outline-none bg-transparent appearance-none">
                {RECURRENCE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={16} className="text-slate-400 flex-shrink-0"/>
            </div>
            <button className="w-full flex items-center gap-4 px-5 py-4 border-b border-slate-100">
              <Users size={20} className="text-slate-400 flex-shrink-0"/>
              <span className="text-slate-400 text-sm">Añadir invitados</span>
            </button>
            <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
              <MapPin size={20} className="text-slate-400 flex-shrink-0"/>
              <input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))}
                placeholder="Añade una ubicación" className="flex-1 text-sm text-slate-700 placeholder-slate-400 focus:outline-none bg-transparent"/>
            </div>
            <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
              <Bell size={20} className="text-slate-400 flex-shrink-0"/>
              <select value={form.notif} onChange={e=>setForm(f=>({...f,notif:Number(e.target.value)}))}
                className="flex-1 text-sm text-slate-700 focus:outline-none bg-transparent appearance-none">
                {NOTIF_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={16} className="text-slate-400 flex-shrink-0"/>
            </div>
            <div className="border-b border-slate-100">
              <button onClick={()=>setEvShowColorPicker(v=>!v)} className="w-full flex items-center gap-4 px-5 py-4 active:bg-slate-50">
                <span className="w-5 h-5 rounded flex-shrink-0" style={{background:colorBg(form.color)}}/>
                <span className="text-slate-700 text-sm flex-1 text-left">{EVENT_COLORS.find(c=>c.value===form.color)?.label}</span>
                <ChevronDown size={16} className="text-slate-400 flex-shrink-0"/>
              </button>
              {evShowColorPicker && (
                <div className="flex gap-3 px-5 pb-4 flex-wrap">
                  {EVENT_COLORS.map(c=>(
                    <button key={c.value} onClick={()=>{setForm(f=>({...f,color:c.value}));setEvShowColorPicker(false)}}
                      className="flex flex-col items-center gap-1">
                      <span className={`w-8 h-8 rounded-full border-2 ${form.color===c.value?'border-slate-400 scale-110':'border-transparent'}`} style={{background:c.bg}}/>
                      <span className="text-[10px] text-slate-500">{c.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-start gap-4 px-5 py-4 border-b border-slate-100">
              <AlignLeft size={20} className="text-slate-400 flex-shrink-0 mt-0.5"/>
              <textarea value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))}
                placeholder="Añade una descripción" rows={2}
                className="flex-1 text-sm text-slate-700 placeholder-slate-400 focus:outline-none bg-transparent resize-none"/>
            </div>
            {editingEvent && !editingEvent._virtual && (
              <button onClick={()=>deleteEvent(editingEvent)} className="w-full flex items-center gap-4 px-5 py-4 text-red-500 active:bg-red-50">
                <Trash2 size={20}/><span className="text-sm font-semibold">Eliminar evento</span>
              </button>
            )}
          </div>
          {evDateView==='start-cal' && (
            <BottomSheet title="Fecha inicio" onClose={()=>setEvDateView('main')} onConfirm={()=>setEvDateView('start-time')} confirmLabel="Hora →">
              <CalendarPicker value={addDate?toStr(addDate):''} onChange={d=>setAddDate(new Date(d+'T00:00:00'))}/>
              <div className="border-t border-slate-100">
                <button onClick={()=>setEvDateView('start-time')} className="flex items-center justify-between w-full px-5 py-4 hover:bg-slate-50">
                  <div className="flex items-center gap-3"><Clock size={18} className="text-slate-400"/><span className="text-sm text-slate-700">Hora de inicio</span></div>
                  <span className="text-blue-500 text-sm font-medium">{fmtTime(form.startH,form.startM)}</span>
                </button>
              </div>
            </BottomSheet>
          )}
          {evDateView==='start-time' && (
            <BottomSheet title="Hora de inicio" onClose={()=>setEvDateView('start-cal')} onConfirm={()=>setEvDateView('main')} confirmLabel="Listo">
              <TimePicker hour={form.startH} minute={form.startM} onChange={(h,m)=>setForm(f=>({...f,startH:h,startM:m}))}/>
            </BottomSheet>
          )}
          {evDateView==='end-cal' && (
            <BottomSheet title="Fecha fin" onClose={()=>setEvDateView('main')} onConfirm={()=>setEvDateView('end-time')} confirmLabel="Hora →">
              <CalendarPicker value={addDate?toStr(addDate):''} onChange={d=>setAddDate(new Date(d+'T00:00:00'))}/>
              <div className="border-t border-slate-100">
                <button onClick={()=>setEvDateView('end-time')} className="flex items-center justify-between w-full px-5 py-4 hover:bg-slate-50">
                  <div className="flex items-center gap-3"><Clock size={18} className="text-slate-400"/><span className="text-sm text-slate-700">Hora de fin</span></div>
                  <span className="text-blue-500 text-sm font-medium">{fmtTime(form.endH,form.endM)}</span>
                </button>
              </div>
            </BottomSheet>
          )}
          {evDateView==='end-time' && (
            <BottomSheet title="Hora de fin" onClose={()=>setEvDateView('end-cal')} onConfirm={()=>setEvDateView('main')} confirmLabel="Listo">
              <TimePicker hour={form.endH} minute={form.endM} onChange={(h,m)=>setForm(f=>({...f,endH:h,endM:m}))}/>
            </BottomSheet>
          )}
        </div>
      )}

      {/* ── Search ── */}
      {showSearch && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <Search size={18} className="text-slate-400 flex-shrink-0"/>
            <input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              placeholder="Buscar eventos y tareas..." className="flex-1 text-sm focus:outline-none text-slate-700"/>
            <button onClick={()=>{setShowSearch(false);setSearchQuery('')}} className="text-blue-600 font-semibold text-sm">Cancelar</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {searchResults.length===0 && q.length>1 && <div className="py-10 text-center"><p className="text-slate-400 text-sm">Sin resultados</p></div>}
            {searchResults.map((r,i)=>(
              <button key={i} onClick={()=>{openDay(new Date(r.date+'T00:00:00'));setShowSearch(false);setSearchQuery('')}}
                className="w-full flex items-center gap-3 px-5 py-4 border-b border-slate-100 active:bg-slate-50 text-left">
                {r.type==='event'
                  ?<div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0"><CalendarDays size={14} className="text-violet-600"/></div>
                  :<div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0"><CheckSquare size={14} className="text-blue-600"/></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{r.label}</p>
                  <p className="text-xs text-slate-400">{r.date && new Date(r.date+'T00:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          DAY VIEW
      ═══════════════════════════════════════ */}
      {view==='day' && selectedDay && (
        <div className="flex flex-col" style={{height:'calc(100vh - 80px)'}}>

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-white flex-shrink-0">
            <button onClick={()=>setView('month')} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 flex-shrink-0">
              <ChevronLeft size={20} className="text-slate-600"/>
            </button>
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-base leading-tight capitalize ${isSameDay(selectedDay,now)?'text-blue-600':'text-slate-800'}`}>
                {selectedDay.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}
              </p>
              {isSameDay(selectedDay,now) && <p className="text-xs text-blue-400 font-medium">Hoy</p>}
            </div>
            <button onClick={prevDay} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><ChevronLeft size={16} className="text-slate-500"/></button>
            <button onClick={nextDay} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><ChevronRight size={16} className="text-slate-500"/></button>
            <button onClick={()=>setShowSearch(true)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><Search size={16} className="text-slate-500"/></button>
          </div>

          {/* All-day strip */}
          {allDayItems.length>0 && (
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex-shrink-0 flex flex-wrap gap-1.5">
              {allDayItems.map(ev=>(
                <div key={ev.id} data-ev="1" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                  style={ev.type==='gym'?{background:GYM_COLOR.bg}
                    :ev.type==='event'?{background:colorBg(ev.color)+'22',border:`1px solid ${colorBg(ev.color)}44`}
                    :{background:ev.completed?'#d1fae5':'#eff6ff',border:'1px solid #bfdbfe'}}>
                  {ev.type==='gym'&&<Dumbbell size={12} style={{color:GYM_COLOR.text}}/>}
                  {ev.type==='task'&&(
                    <button onClick={()=>toggleTask(ev.task)}
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${ev.completed?'bg-blue-500 border-blue-500':'border-blue-300'}`}>
                      {ev.completed&&<Check size={8} className="text-white"/>}
                    </button>
                  )}
                  <span className={`text-xs font-semibold ${ev.completed?'line-through text-slate-400':''}`}
                    style={{color:ev.type==='gym'?GYM_COLOR.text:ev.type==='event'?colorBg(ev.color):'#1d4ed8'}}>{ev.label}</span>
                  {ev.type==='task'&&<button onClick={()=>deleteTask(ev.task)} className="ml-0.5 opacity-50"><X size={10} className="text-slate-500"/></button>}
                  {ev.type==='event'&&!ev.raw?._virtual&&<button onClick={()=>openEditEvent(ev.raw)} className="ml-0.5 opacity-50"><Edit2 size={10} className="text-slate-500"/></button>}
                </div>
              ))}
            </div>
          )}

          {/* Hint */}
          {selDayItems.length===0 && (
            <div className="px-4 pt-2 pb-1 flex-shrink-0 text-center">
              <p className="text-xs text-slate-400">Toca y arrastra para crear un evento</p>
            </div>
          )}

          {/* Hourly timeline */}
          <div ref={dayViewRef} className="flex-1 overflow-y-auto bg-white select-none">
            <div ref={gridRef} style={{display:'flex', height:24*HOUR_H, position:'relative', cursor:'crosshair'}}>

              {/* Time gutter */}
              <div className="flex-shrink-0" style={{width:52}}>
                {Array.from({length:24},(_,h)=>(
                  <div key={h} style={{height:HOUR_H, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:8, paddingTop:6}}>
                    <span style={{fontSize:10,color:'#94a3b8',fontWeight:500,lineHeight:1}}>{String(h).padStart(2,'0')}:00</span>
                  </div>
                ))}
              </div>

              {/* Grid area */}
              <div style={{flex:1, position:'relative', borderLeft:'1px solid #e2e8f0'}}>
                {/* Hour lines */}
                {Array.from({length:24},(_,h)=>(
                  <div key={h} style={{position:'absolute',top:h*HOUR_H,left:0,right:0,borderTop:`1px solid ${h===0?'transparent':'#f1f5f9'}`}}/>
                ))}
                {/* Half-hour dashed lines */}
                {Array.from({length:24},(_,h)=>(
                  <div key={'d'+h} style={{position:'absolute',top:h*HOUR_H+HOUR_H/2,left:0,right:0,borderTop:'1px dashed #f8fafc'}}/>
                ))}

                {/* Current time line */}
                {selectedDay && isSameDay(selectedDay,now) && (
                  <div style={{position:'absolute',top:(nowMin/60)*HOUR_H,left:-5,right:0,zIndex:10,display:'flex',alignItems:'center',pointerEvents:'none'}}>
                    <div style={{width:10,height:10,borderRadius:'50%',background:'#ef4444',flexShrink:0}}/>
                    <div style={{flex:1,height:2,background:'#ef4444'}}/>
                  </div>
                )}

                {/* Timed events — columns for overlapping events */}
                {layoutEvents(timedItems).map(ev=>{
                  const startMin  = timeToMin(ev.time)
                  const endMin    = ev.endTime ? timeToMin(ev.endTime) : startMin+60
                  const top       = (startMin/60)*HOUR_H
                  const height    = Math.max(((endMin-startMin)/60)*HOUR_H, 28)
                  const bg        = ev.type==='gym'?GYM_COLOR.bg:colorBg(ev.color)+'22'
                  const tc        = ev.type==='gym'?GYM_COLOR.text:colorBg(ev.color)
                  const bdr       = ev.type==='gym'?GYM_COLOR.text:colorBg(ev.color)
                  const isShortEv = height < 38
                  const colPct    = 100 / ev._totalCols
                  const leftPct   = ev._col * colPct
                  const rightPct  = 100 - leftPct - colPct
                  const GAP       = 2
                  const isDragged = dragging?.ev.raw?.id === ev.raw?.id
                  return (
                    <button key={ev.id} data-ev="1" data-evid={ev.raw?.id || ''}
                      onClick={e=>{e.stopPropagation();if(!dragging)ev.raw&&openEditEvent(ev.raw)}}
                      style={{
                        position:'absolute', top:top+1, height:height-2,
                        left:`calc(${leftPct}% + ${ev._col===0?4:GAP}px)`,
                        right:`calc(${rightPct}% + ${ev._col===ev._totalCols-1?4:GAP}px)`,
                        background:bg, borderRadius:8, borderLeft:`4px solid ${bdr}`,
                        overflow:'hidden', textAlign:'left', padding:'4px 6px', zIndex:5, cursor:'grab',
                        opacity: isDragged ? 0.25 : 1,
                        transition: isDragged ? 'none' : 'opacity 0.15s',
                      }}>
                      <p style={{fontSize:11,fontWeight:700,color:tc,lineHeight:1.3,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.label}</p>
                      {!isShortEv && (
                        <p style={{fontSize:10,color:tc+'99',margin:0}}>
                          {ev.time?.slice(0,5)}{ev.endTime?` – ${ev.endTime.slice(0,5)}` :''}
                        </p>
                      )}
                    </button>
                  )
                })}

                {/* Drag-to-move ghost */}
                {dragging && (()=>{
                  const { ev, dur, currentStartMin } = dragging
                  const topPx    = (currentStartMin/60)*HOUR_H
                  const heightPx = Math.max((dur/60)*HOUR_H, 28)
                  const bg  = ev.type==='gym'?GYM_COLOR.bg:colorBg(ev.color)+'33'
                  const tc  = ev.type==='gym'?GYM_COLOR.text:colorBg(ev.color)
                  const bdr = tc
                  const eMin = currentStartMin+dur
                  const isShort = heightPx < 38
                  return (
                    <div style={{
                      position:'absolute', top:topPx, left:4, right:4, height:heightPx,
                      background:bg, borderRadius:8, borderLeft:`4px solid ${bdr}`,
                      zIndex:30, pointerEvents:'none',
                      boxShadow:'0 6px 20px rgba(0,0,0,0.22)',
                      overflow:'hidden', padding:'4px 8px',
                      transform:'scale(1.015)',
                    }}>
                      <p style={{fontSize:11,fontWeight:700,color:tc,margin:0,lineHeight:1.3}}>{ev.label}</p>
                      {!isShort && (
                        <p style={{fontSize:10,color:tc+'aa',margin:0}}>
                          {fmtTime(Math.floor(currentStartMin/60), currentStartMin%60)} – {fmtTime(Math.floor(eMin/60), eMin%60)}
                        </p>
                      )}
                    </div>
                  )
                })()}

                {/* Ghost block (drag-to-create) */}
                <GhostBlock/>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MONTH / WEEK / AGENDA views
      ═══════════════════════════════════════ */}
      {view!=='day' && (
        <>
          {/* Month strip */}
          <div ref={monthStripRef} className="flex gap-2 overflow-x-auto px-4 lg:px-8 pb-3 pt-2" style={{scrollbarWidth:'none'}}>
            {stripMonths.map((m,i)=>{
              const isCur=m.getMonth()===month&&m.getFullYear()===year
              return (
                <button key={i} data-current={isCur?'true':undefined} onClick={()=>setCurrentMonth(new Date(m))}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors
                    ${isCur?'bg-blue-600 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {MONTHS_SHORT[m.getMonth()]}
                </button>
              )
            })}
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 lg:px-8 pb-2">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-800 text-lg">{MONTHS_FULL[month]} {year}</h2>
              <button onClick={goToToday} className="text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg">Hoy</button>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={()=>setShowSearch(true)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
                <Search size={17} className="text-slate-600"/>
              </button>
              <div className="flex gap-0.5 bg-slate-100 rounded-xl p-1 ml-1">
                {['month','week','agenda'].map(v=>(
                  <button key={v} onClick={()=>setView(v)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${view===v?'bg-white text-slate-800 shadow-sm':'text-slate-500'}`}>
                    {v==='month'?'Mes':v==='week'?'Sem':'Agenda'}
                  </button>
                ))}
              </div>
              <div className="flex gap-0.5 ml-1">
                <button onClick={()=>setCurrentMonth(new Date(year,month-1,1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100"><ChevronLeft size={16} className="text-slate-600"/></button>
                <button onClick={()=>setCurrentMonth(new Date(year,month+1,1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100"><ChevronRight size={16} className="text-slate-600"/></button>
              </div>
            </div>
          </div>

          {/* ── MONTH ── */}
          {view==='month' && (
            <>
              <div className="grid grid-cols-7 border-b border-slate-200 px-4 lg:px-8">
                {DAYS_SHORT.map(d=><div key={d} className="text-center text-xs font-bold text-slate-500 py-2">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 px-4 lg:px-8">
                {grid.map((date,i)=>{
                  if(!date) return <div key={i} className="border-b border-r border-slate-100 min-h-[90px]"/>
                  const isToday=isSameDay(date,now)
                  const evs=eventsForDay(date)
                  const visible=evs.slice(0,MAX_CHIPS); const hidden=evs.length-MAX_CHIPS
                  return (
                    <button key={i} onClick={()=>openDay(date)}
                      className="border-b border-r border-slate-100 p-1 text-left min-h-[90px] active:bg-slate-50">
                      <div className="mb-1">
                        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full
                          ${isToday?'bg-blue-600 text-white':'text-slate-700'}`}>{date.getDate()}</span>
                      </div>
                      <div className="space-y-0.5">
                        {visible.map(ev=>{
                          const col=ev.type==='gym'?GYM_COLOR
                            :ev.type==='event'?{bg:colorBg(ev.color)+'33',text:colorBg(ev.color)}
                            :ev.completed?{bg:'#d1fae5',text:'#065f46'}:titleColor(ev.label)
                          return (
                            <div key={ev.id} style={{background:col.bg,color:col.text}}
                              className="text-[10px] font-semibold rounded px-1 py-0.5 truncate leading-tight">
                              {ev.time?`${ev.time.slice(0,5)} `:''}{ev.label}
                            </div>
                          )
                        })}
                        {hidden>0&&<div className="text-[10px] text-slate-400 font-semibold px-1">+{hidden} más</div>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* ── WEEK ── */}
          {view==='week' && (
            <div>
              <div className="flex items-center justify-between px-4 lg:px-8 pb-2">
                <button onClick={()=>{const d=new Date(selectedDay||now);d.setDate(d.getDate()-7);setSelectedDay(d)}} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><ChevronLeft size={18}/></button>
                <span className="text-sm font-semibold text-slate-600">
                  {weekDays[0].toLocaleDateString('es-ES',{day:'numeric',month:'short'})} — {weekDays[6].toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}
                </span>
                <button onClick={()=>{const d=new Date(selectedDay||now);d.setDate(d.getDate()+7);setSelectedDay(d)}} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><ChevronRight size={18}/></button>
              </div>
              <div className="grid grid-cols-7 px-4 lg:px-8 border-b border-slate-200 pb-2">
                {weekDays.map((date,i)=>{
                  const isToday=isSameDay(date,now)
                  const dots=eventsForDay(date).length>0
                  return (
                    <button key={i} onClick={()=>openDay(date)} className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] font-bold text-slate-400">{DAYS_SHORT[i]}</span>
                      <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold
                        ${isToday?'bg-blue-600 text-white':'text-slate-700'}`}>{date.getDate()}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${dots?'bg-blue-400':'bg-transparent'}`}/>
                    </button>
                  )
                })}
              </div>
              <div className="overflow-y-auto px-4 lg:px-8" style={{maxHeight:'60vh'}}>
                <div className="flex relative" style={{minHeight:24*HOUR_H}}>
                  <div className="w-12 flex-shrink-0">
                    {Array.from({length:24},(_,h)=>(
                      <div key={h} style={{height:HOUR_H}} className="flex items-start justify-end pr-2 pt-1">
                        <span className="text-[10px] text-slate-400 font-medium">{String(h).padStart(2,'0')}:00</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-1">
                    {weekDays.map((date,di)=>{
                      const dayEvs=eventsForDay(date).filter(e=>e.time)
                      return (
                        <div key={di} className="flex-1 relative border-l border-slate-100">
                          {Array.from({length:24},(_,h)=>(<div key={h} style={{height:HOUR_H}} className="border-t border-slate-100"/>))}
                          {dayEvs.map(ev=>{
                            const sm=timeToMin(ev.time),em=ev.endTime?timeToMin(ev.endTime):sm+60
                            const top=(sm/60)*HOUR_H,height=Math.max(((em-sm)/60)*HOUR_H,20)
                            const bg=ev.type==='gym'?'#ede9fe':colorBg(ev.color)+'33'
                            const tc=ev.type==='gym'?'#6d28d9':colorBg(ev.color)
                            return (
                              <button key={ev.id} onClick={()=>openDay(date)}
                                style={{position:'absolute',top,left:2,right:2,height,background:bg,borderRadius:6,borderLeft:`3px solid ${tc}`,overflow:'hidden'}}
                                className="text-left px-1 py-0.5">
                                <span className="text-[10px] font-semibold" style={{color:tc}}>{ev.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── AGENDA ── */}
          {view==='agenda' && (
            <div className="px-4 lg:px-8 space-y-3">
              {(()=>{
                const agenda=[]
                for(let i=0;i<60;i++){const d=new Date(now);d.setDate(now.getDate()+i);const evs=eventsForDay(d);if(evs.length) agenda.push({date:d,evs})}
                if(!agenda.length) return <div className="bg-white rounded-2xl shadow-sm px-5 py-10 text-center"><p className="text-slate-400 text-sm">Sin eventos próximos</p></div>
                return agenda.map(({date,evs})=>(
                  <div key={toStr(date)} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <button onClick={()=>openDay(date)} className={`w-full px-5 py-3 border-b border-slate-50 text-left ${isSameDay(date,now)?'bg-blue-50':''}`}>
                      <p className={`text-sm font-bold capitalize ${isSameDay(date,now)?'text-blue-600':'text-slate-700'}`}>
                        {isSameDay(date,now)?'Hoy · ':''}{date.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}
                      </p>
                    </button>
                    {evs.map(ev=>(
                      <div key={ev.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-50 last:border-0">
                        {ev.type==='gym'?<div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0"><Dumbbell size={14} className="text-violet-600"/></div>
                          :ev.type==='event'?<div className="w-3 h-3 rounded-full flex-shrink-0" style={{background:colorBg(ev.color)}}/>
                          :<button onClick={()=>toggleTask(ev.task)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${ev.completed?'bg-blue-500 border-blue-500':'border-slate-300'}`}>{ev.completed&&<Check size={10} className="text-white"/>}</button>}
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm block truncate ${ev.completed?'line-through text-slate-400':'text-slate-700'}`}>{ev.label}</span>
                          {ev.time&&<span className="text-xs text-slate-400">{ev.time.slice(0,5)}</span>}
                        </div>
                        {ev.type==='event'&&!ev.raw?._virtual&&<button onClick={()=>openEditEvent(ev.raw)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><Edit2 size={14} className="text-slate-400"/></button>}
                      </div>
                    ))}
                  </div>
                ))
              })()}
            </div>
          )}
        </>
      )}

      {/* FAB */}
      <button onClick={()=>{setAddDate(selectedDay||now);setShowFabMenu(true)}}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center z-40 active:bg-blue-700"
        style={{boxShadow:'0 4px 20px rgba(37,99,235,0.4)'}}>
        <Plus size={26}/>
      </button>
    </div>
  )
}
