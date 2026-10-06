"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import Map, { Marker, NavigationControl, type MapMouseEvent } from "react-map-gl/maplibre";
import { Building2, CheckCircle2, Crosshair, EyeOff, HeartHandshake, ListFilter, MapPin, Plus, Search, ShieldAlert, Sparkles, X } from "lucide-react";
import { createNeed } from "@/app/actions/needs";
import { NeedActions } from "@/components/need-actions";
import { formatWhen } from "@/lib/format";
import { statusLabels, type MapNeed } from "@/lib/needs";

export type { MapNeed };
const detail={public_cleanup:{label:"Community-ready",icon:Sparkles,className:"ready"},city_hazard:{label:"City referral",icon:Building2,className:"city"},neighbor_help:{label:"Neighbor support",icon:HeartHandshake,className:"neighbor"}};
type MapView = "streets" | "3d" | "satellite";
const rasterStyle = (tiles:string, attribution:string, maxzoom=19) => ({
  version:8 as const,
  sources:{basemap:{type:"raster" as const,tiles:[tiles],tileSize:256,attribution,maxzoom}},
  layers:[{id:"basemap",type:"raster" as const,source:"basemap"}],
});
const streetStyle = rasterStyle("https://tile.openstreetmap.org/{z}/{x}/{y}.png", '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>');
const satelliteStyle = rasterStyle("https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}", "Imagery courtesy U.S. Geological Survey", 16);

export function MapWorkspace({initialNeeds,signedIn,demo}:{initialNeeds:MapNeed[];signedIn:boolean;demo:boolean}){
  const [filter,setFilter]=useState("all"); const [selectedId,setSelectedId]=useState<string|null>(initialNeeds[0]?.id??null); const [reporting,setReporting]=useState(false); const [pin,setPin]=useState({latitude:29.3958,longitude:-94.9162}); const [query,setQuery]=useState("");
  const [view,setView]=useState<MapView>("streets"); const [mapError,setMapError]=useState(false);
  const [camera,setCamera]=useState({longitude:-94.9162,latitude:29.3958,zoom:13.2});
  function changeView(next:MapView){setMapError(false);setView(next)}
  const selected=initialNeeds.find(n=>n.id===selectedId)??null;
  const shown=useMemo(()=>initialNeeds.filter(n=>(filter==="all"||n.kind===filter)&&(`${n.title} ${n.category} ${n.location}`.toLowerCase().includes(query.toLowerCase()))),[initialNeeds,filter,query]);
  function mapClick(event:MapMouseEvent){setPin({latitude:event.lngLat.lat,longitude:event.lngLat.lng});setReporting(true)}
  return <section className="explore" id="explore">
    <div className="explore-heading"><div><p className="eyebrow">Around Texas City</p><h2>Find a place to help</h2></div><button className="report-cta" onClick={()=>setReporting(true)}><Plus size={18}/>Pin a new need</button></div>
    {demo&&<p className="demo-banner">Showing sample reports. Connect a database to start the live community map.</p>}
    <div className="workspace">
      <aside className="need-list"><label className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search needs or streets"/></label><div className="filter-row"><ListFilter size={16}/>{[["all","All"],["public_cleanup","Community"],["city_hazard","City"],["neighbor_help","Neighbor"]].map(([value,label])=><button key={value} className={filter===value?"active":""} onClick={()=>setFilter(value)}>{label}</button>)}</div><div className="result-count">{shown.length} nearby {shown.length===1?"need":"needs"}</div><div className="results">{shown.length===0&&<p className="empty-note">No approved reports yet. Tap the map to submit one for review.</p>}{shown.map(need=>{const d=detail[need.kind as keyof typeof detail];const Icon=d.icon;return <button className={`result-card ${selectedId===need.id?"selected":""}`} key={need.id} onClick={()=>setSelectedId(need.id)}><div><span className={`status ${d.className}`}><Icon size={13}/>{d.label}</span><small>{statusLabels[need.status]??need.status} · {formatWhen(need.createdAt)}{need.requestType==="jump_start"?" · Jump start":""}</small></div><strong>{need.title}</strong><p><MapPin size={14}/>{need.location}</p></button>})}</div></aside>
      <div className="map-shell"><Map key={view} initialViewState={{...camera,zoom:view==="3d"?Math.max(camera.zoom,14):camera.zoom,pitch:view==="3d"?60:0,bearing:view==="3d"?-20:0}} onMoveEnd={event=>{const {longitude,latitude,zoom}=event.viewState;setCamera({longitude,latitude,zoom})}} mapStyle={view==="3d"?"https://tiles.openfreemap.org/styles/bright":view==="satellite"?satelliteStyle:streetStyle} onClick={mapClick} onError={()=>setMapError(true)} onLoad={event=>{if(view==="3d"&&event.target.getSource("openmaptiles"))event.target.addLayer({id:"buildings-3d",type:"fill-extrusion",source:"openmaptiles","source-layer":"building",minzoom:14,paint:{"fill-extrusion-color":"#c7b9a5","fill-extrusion-height":["coalesce",["get","render_height"],["get","height"],10],"fill-extrusion-base":["coalesce",["get","render_min_height"],["get","min_height"],0],"fill-extrusion-opacity":0.8}})}} cursor="crosshair"><NavigationControl position="bottom-right" showCompass={view==="3d"}/>{shown.map(need=><Marker key={need.id} longitude={need.longitude} latitude={need.latitude} anchor="bottom"><button aria-label={`View ${need.title}`} className={`map-pin ${need.kind} ${selectedId===need.id?"active":""} ${need.approximate?"approximate":""}`} onClick={e=>{e.stopPropagation();setSelectedId(need.id)}}><span/></button></Marker>)}{reporting&&<Marker longitude={pin.longitude} latitude={pin.latitude} anchor="bottom"><div className="new-pin"><MapPin/></div></Marker>}</Map><div className="map-tip"><Crosshair size={16}/>Tap anywhere to report at that spot</div><div className="map-views" role="group" aria-label="Map view">{(["streets","3d","satellite"] as const).map(option=><button key={option} type="button" aria-pressed={view===option} onClick={()=>changeView(option)}>{option==="streets"?"Streets":option==="3d"?"3D":"Satellite"}</button>)}</div>{mapError&&<div className="map-error" role="status">Map tiles could not load. Try another view or check your connection.</div>}{selected&&!reporting&&<article className="map-detail"><button className="detail-close" onClick={()=>setSelectedId(null)} aria-label="Close details"><X size={17}/></button><div className="detail-tags"><span className={`status ${detail[selected.kind as keyof typeof detail].className}`}>{detail[selected.kind as keyof typeof detail].label}</span><span className="status-pill">{statusLabels[selected.status]??selected.status}</span></div><h3>{selected.title}</h3><p>{selected.description}</p>{selected.requestType==="jump_start"&&<p className="equipment-hint">Needs: {selected.requiredEquipment?.join(" or ") || "jump-start equipment"}{selected.vehicleType?` · ${selected.vehicleType==="passenger_car"?"passenger car":"light truck"}`:""}</p>}<div className="detail-location">{selected.approximate?<EyeOff size={17}/>:<MapPin size={17}/>}{selected.privateLocation??selected.location}, {selected.city}</div><NeedActions need={selected}/></article>}</div>
    </div>
    {reporting&&<ReportSheet pin={pin} setPin={setPin} signedIn={signedIn} demo={demo} close={()=>setReporting(false)}/>} 
  </section>
}

function ReportSheet({pin,setPin,signedIn,demo,close}:{pin:{latitude:number;longitude:number};setPin:(p:{latitude:number;longitude:number})=>void;signedIn:boolean;demo:boolean;close:()=>void}){
  const [state,setState]=useState<"idle"|"saving"|"saved"|"error">("idle");
  const [error,setError]=useState("");
  const [step,setStep]=useState(1);
  const [kind,setKind]=useState("public_cleanup");
  const [requestType,setRequestType]=useState("general");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setState("saving");
    const form=new FormData(event.currentTarget);
    try{
      const res=await createNeed({...Object.fromEntries(form),...pin});
      setState(res.ok?"saved":"error");
      setError(res.message);
      if(res.ok)setTimeout(close,1200);
    }catch{
      setState("error");
      setError("We couldn’t save this yet. Please try again.");
    }
  }
  const gate=demo?<div className="success"><ShieldAlert/><h2>Sample mode</h2><p>Requests can be added once this deployment is connected to a database.</p></div>:null;
  const jumpStart=kind==="neighbor_help"&&requestType==="jump_start";
  return <div className="sheet-backdrop" onMouseDown={close}><aside className="report-sheet" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="report-title"><button className="sheet-close" onClick={close} aria-label="Close"><X/></button>{gate??(state==="saved"?<div className="success"><CheckCircle2/><h2>Submitted for review</h2><p>A moderator will review your request before it appears to eligible helpers.</p></div>:<form onSubmit={submit}><div className="sheet-step">Step {step} of 2</div><h2 id="report-title">{step===1?"Is this the right spot?":"What kind of help is needed?"}</h2>{step===1?<><div className="coordinate-card"><MapPin/><div><strong>Selected map location</strong><span>{pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}</span></div></div><p className="sheet-help">For a private neighbor request, use the exact location. The public map will show only an approximate area.</p><div className="coordinate-fields"><label>Latitude<input type="number" step="any" value={pin.latitude} onChange={e=>setPin({...pin,latitude:Number(e.target.value)})}/></label><label>Longitude<input type="number" step="any" value={pin.longitude} onChange={e=>setPin({...pin,longitude:Number(e.target.value)})}/></label></div><button type="button" className="primary-button wide" onClick={()=>setStep(2)}>Use this location</button></>:<><label>Who should handle it?<select name="kind" required value={kind} onChange={e=>{setKind(e.target.value);if(e.target.value!=="neighbor_help")setRequestType("general")}}><option value="public_cleanup">Community volunteers</option><option value="city_hazard">City or trained crews</option><option value="neighbor_help">Approved neighbor support</option></select></label>{kind==="neighbor_help"&&<label>What kind of neighbor support?<select name="requestType" value={requestType} onChange={e=>setRequestType(e.target.value)}><option value="general">General neighbor support</option><option value="jump_start">Jump start</option></select></label>}
      {jumpStart?<><input type="hidden" name="title" value="Jump start needed"/><input type="hidden" name="description" value="A neighbor is requesting a jump start with compatible equipment. Exact details are shared only with the accepted helper."/><input type="hidden" name="category" value="Jump start"/>
        <p className="sheet-help">Request help only when the vehicle is parked fully away from moving traffic. If it is on a shoulder or near a live lane, use roadside assistance or call 911 if anyone is in immediate danger.</p>
        <label>Vehicle type<select name="vehicleType" required><option value="">Choose one</option><option value="passenger_car">Passenger car</option><option value="light_truck">Light truck</option></select></label>
        <fieldset className="equipment-options"><legend>What equipment can help?</legend><label className="checkbox"><input type="checkbox" name="needsCables"/>Jumper cables</label><label className="checkbox"><input type="checkbox" name="needsJumpPack"/>Portable jump pack</label><small>Choose one or both. A helper with either selected item may offer.</small></fieldset>
        <fieldset className="equipment-options"><legend>Confirm all safety conditions</legend><label className="checkbox"><input type="checkbox" name="safeLocationConfirmed" required/>The vehicle is completely off the roadway in a driveway or parking space.</label><label className="checkbox"><input type="checkbox" name="standard12vConfirmed" required/>This is a standard 12V system, not a hybrid or electric vehicle, and I have checked the maker’s jump-start guidance.</label><label className="checkbox"><input type="checkbox" name="hazardFreeConfirmed" required/>There is no smoke, leaking, visible battery damage, fuel odor, or other vehicle hazard.</label></fieldset>
      </>:<><label>Short title<input name="title" required minLength={5} maxLength={100} placeholder="A small task a neighbor can safely help with"/></label><label>What should people know?<textarea name="description" required minLength={10} maxLength={1000} placeholder={kind==="neighbor_help"?"Describe the help needed. Don’t include names, phone numbers, or health details.":"Describe the size, tools needed, and any safety concerns."}/></label><div className="form-row"><label>Category<input name="category" required minLength={2} maxLength={50} placeholder="Yard work"/></label><label>City<input name="city" required defaultValue="Texas City"/></label></div></>}
      {jumpStart&&<input type="hidden" name="city" value="Texas City"/>}
      {!jumpStart&&kind==="city_hazard"&&<input type="hidden" name="requestType" value="general"/>}
      {!jumpStart&&kind==="public_cleanup"&&<input type="hidden" name="requestType" value="general"/>}
      <label>{kind==="neighbor_help"?"Exact address or directions (private)":"Location note"}<input name="location" required minLength={3} maxLength={160} placeholder={kind==="neighbor_help"?"Only shared with the helper you accept":"Nearest cross street or landmark"}/></label>{kind==="neighbor_help"&&<p className="sheet-help">Your exact location is shared only with the vetted helper you accept. <Link href="/signin?next=/%23explore">Sign in</Link> or <Link href="/signup?next=/%23explore">create an account</Link> to request help.</p>}<div className="safety-note"><ShieldAlert/><span>Never enter traffic or handle power lines, hazardous materials, suspended limbs, or a vehicle with visible hazards. City hazards belong to trained crews.</span></div>{state==="error"&&<p className="form-error">{error||"We couldn’t save this yet. Please check the details."}</p>}<div className="sheet-actions"><button type="button" onClick={()=>setStep(1)}>Back</button>{kind==="neighbor_help"&&!signedIn?<Link className="primary-button" href="/signin?next=/%23explore">Sign in to request help</Link>:<button className="primary-button" disabled={state==="saving"}>{state==="saving"?"Submitting…":"Submit for review"}</button>}</div></>}</form>)}</aside></div>
}
