"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Map, { Marker, NavigationControl, type MapMouseEvent } from "react-map-gl/maplibre";
import { Building2, CheckCircle2, Crosshair, EyeOff, HeartHandshake, ListFilter, MapPin, Plus, Search, ShieldAlert, Sparkles, X } from "lucide-react";
import { createNeed } from "@/app/actions/needs";
import { NeedActions } from "@/components/need-actions";
import { formatWhen } from "@/lib/format";
import { statusLabels, type MapNeed } from "@/lib/needs";
import { REPORT_CATEGORIES } from "@/lib/report-categories";

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
  const [filter,setFilter]=useState("all"); const [selectedId,setSelectedId]=useState<string|null>(initialNeeds[0]?.id??null); const [reporting,setReporting]=useState(false); const [pin,setPin]=useState<{latitude:number;longitude:number}|null>(null); const [resumeCategory,setResumeCategory]=useState<string|null>(null); const [query,setQuery]=useState("");
  useEffect(()=>{
    try{
      if(sessionStorage.getItem("civichands-report-resume")!=="1")return;
      sessionStorage.removeItem("civichands-report-resume");
      const savedPin=sessionStorage.getItem("civichands-report-pin");
      const savedCategory=sessionStorage.getItem("civichands-report-category");
      sessionStorage.removeItem("civichands-report-pin");
      sessionStorage.removeItem("civichands-report-category");
      if(savedPin){
        const parsed=JSON.parse(savedPin) as {latitude?:unknown;longitude?:unknown};
        const latitude=Number(parsed.latitude),longitude=Number(parsed.longitude);
        if(Number.isFinite(latitude)&&latitude>=-90&&latitude<=90&&Number.isFinite(longitude)&&longitude>=-180&&longitude<=180)setPin({latitude,longitude});
      }
      if(savedCategory&&REPORT_CATEGORIES.some(item=>item.id===savedCategory))setResumeCategory(savedCategory);
      setReporting(true);
    }catch{
      setReporting(true);
    }
  },[]);
  const [view,setView]=useState<MapView>("streets"); const [mapError,setMapError]=useState(false);
  const [camera,setCamera]=useState({longitude:-94.9162,latitude:29.3958,zoom:13.2});
  function changeView(next:MapView){setMapError(false);setView(next)}
  const selected=initialNeeds.find(n=>n.id===selectedId)??null;
  const shown=useMemo(()=>initialNeeds.filter(n=>(filter==="all"||n.kind===filter)&&(`${n.title} ${n.category} ${n.location}`.toLowerCase().includes(query.toLowerCase()))),[initialNeeds,filter,query]);
  function mapClick(event:MapMouseEvent){setPin({latitude:event.lngLat.lat,longitude:event.lngLat.lng});setReporting(true)}
  return <section className="explore" id="explore">
    <div className="explore-heading"><div><p className="eyebrow">Around Texas City</p><h2>Find a place to help</h2></div><button className="report-cta" onClick={()=>setReporting(true)}><Plus size={18}/>Report a need</button></div>
    {demo&&<p className="demo-banner">Showing sample reports. Connect a database to start the live community map.</p>}
    <div className="workspace">
      <aside className="need-list"><label className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search needs or streets"/></label><div className="filter-row"><ListFilter size={16}/>{[["all","All"],["public_cleanup","Community"],["city_hazard","City"],["neighbor_help","Neighbor"]].map(([value,label])=><button key={value} className={filter===value?"active":""} onClick={()=>setFilter(value)}>{label}</button>)}</div><div className="result-count">{shown.length} nearby {shown.length===1?"need":"needs"}</div><div className="results">{shown.length===0&&<p className="empty-note">No approved reports yet. Choose “Report a need” to submit one. A map pin is optional.</p>}{shown.map(need=>{const d=detail[need.kind as keyof typeof detail];const Icon=d.icon;return <button className={`result-card ${selectedId===need.id?"selected":""}`} key={need.id} onClick={()=>setSelectedId(need.id)}><div><span className={`status ${d.className}`}><Icon size={13}/>{d.label}</span><small>{statusLabels[need.status]??need.status} · {formatWhen(need.createdAt)}{need.requestType==="jump_start"?" · Jump start":""}</small></div><strong>{need.title}</strong><p><MapPin size={14}/>{need.location}</p></button>})}</div></aside>
      <div className="map-shell"><Map key={view} initialViewState={{...camera,zoom:view==="3d"?Math.max(camera.zoom,14):camera.zoom,pitch:view==="3d"?60:0,bearing:view==="3d"?-20:0}} onMoveEnd={event=>{const {longitude,latitude,zoom}=event.viewState;setCamera({longitude,latitude,zoom})}} mapStyle={view==="3d"?"https://tiles.openfreemap.org/styles/bright":view==="satellite"?satelliteStyle:streetStyle} onClick={mapClick} onError={()=>setMapError(true)} onLoad={event=>{if(view==="3d"&&event.target.getSource("openmaptiles"))event.target.addLayer({id:"buildings-3d",type:"fill-extrusion",source:"openmaptiles","source-layer":"building",minzoom:14,paint:{"fill-extrusion-color":"#c7b9a5","fill-extrusion-height":["coalesce",["get","render_height"],["get","height"],10],"fill-extrusion-base":["coalesce",["get","render_min_height"],["get","min_height"],0],"fill-extrusion-opacity":0.8}})}} cursor="crosshair"><NavigationControl position="bottom-right" showCompass={view==="3d"}/>{shown.filter(need=>need.latitude!==null&&need.longitude!==null).map(need=><Marker key={need.id} longitude={need.longitude!} latitude={need.latitude!} anchor="bottom"><button aria-label={`View ${need.title}`} className={`map-pin ${need.kind} ${selectedId===need.id?"active":""} ${need.approximate?"approximate":""}`} onClick={e=>{e.stopPropagation();setSelectedId(need.id)}}><span/></button></Marker>)}{reporting&&pin&&<Marker longitude={pin.longitude} latitude={pin.latitude} anchor="bottom"><div className="new-pin"><MapPin/></div></Marker>}</Map><div className="map-tip"><Crosshair size={16}/>Tap anywhere to report at that spot</div><div className="map-views" role="group" aria-label="Map view">{(["streets","3d","satellite"] as const).map(option=><button key={option} type="button" aria-pressed={view===option} onClick={()=>changeView(option)}>{option==="streets"?"Streets":option==="3d"?"3D":"Satellite"}</button>)}</div>{mapError&&<div className="map-error" role="status">Map tiles could not load. Try another view or check your connection.</div>}{selected&&!reporting&&<article className="map-detail"><button className="detail-close" onClick={()=>setSelectedId(null)} aria-label="Close details"><X size={17}/></button><div className="detail-tags"><span className={`status ${detail[selected.kind as keyof typeof detail].className}`}>{detail[selected.kind as keyof typeof detail].label}</span><span className="status-pill">{statusLabels[selected.status]??selected.status}</span></div><h3>{selected.title}</h3><p>{selected.description}</p>{selected.requestType==="jump_start"&&<p className="equipment-hint">Needs: {selected.requiredEquipment?.join(" or ") || "jump-start equipment"}{selected.vehicleType?` · ${selected.vehicleType==="passenger_car"?"passenger car":"light truck"}`:""}</p>}{selected.privateLocationDetails&&<p className="private-location-detail">{selected.privateLocationDetails}</p>}<div className="detail-location">{selected.approximate?<EyeOff size={17}/>:<MapPin size={17}/>}{selected.privateLocation??selected.location}, {selected.city}</div><NeedActions need={selected}/></article>}</div>
    </div>
    {reporting&&<ReportSheet pin={pin} setPin={setPin} signedIn={signedIn} demo={demo} initialCategory={resumeCategory??undefined} close={()=>setReporting(false)}/>} 
  </section>
}

function ReportSheet({pin,setPin,signedIn,demo,initialCategory,close}:{pin:{latitude:number;longitude:number}|null;setPin:(p:{latitude:number;longitude:number}|null)=>void;signedIn:boolean;demo:boolean;initialCategory?:string;close:()=>void}){
  const [state,setState]=useState<"idle"|"saving"|"saved"|"error">("idle");
  const [error,setError]=useState("");
  const [locationError,setLocationError]=useState("");
  const [locationBusy,setLocationBusy]=useState(false);
  const [step,setStep]=useState(1);
  const [category,setCategory]=useState(initialCategory??"neighborhood_cleanup");
  const selectedCategory=REPORT_CATEGORIES.find(item=>item.id===category)??REPORT_CATEGORIES[0];
  const jumpStart=category==="jump_start";
  const petReport=category==="lost_pet"||category==="found_pet";
  const externalReferral=category==="tow_referral";
  const privateRequest=selectedCategory.kind==="neighbor_help";
  function useDeviceLocation(){
    setLocationError("");
    if(!navigator.geolocation){setLocationError("Your browser does not provide device location. You can continue with a landmark or address.");return;}
    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(
      position=>{setPin({latitude:position.coords.latitude,longitude:position.coords.longitude});setLocationBusy(false);},
      ()=>{setLocationError("Location permission was unavailable. You can tap the map or enter a landmark instead.");setLocationBusy(false);},
      {enableHighAccuracy:true,timeout:10000,maximumAge:60000},
    );
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setState("saving");setError("");
    const form=new FormData(event.currentTarget),values=Object.fromEntries(form) as Record<string,unknown>;
    if(values.latitude==="")values.latitude=undefined;
    if(values.longitude==="")values.longitude=undefined;
    try{const res=await createNeed(values);setState(res.ok?"saved":"error");setError(res.message);if(res.ok)setTimeout(close,1200);}
    catch{setState("error");setError("We couldn’t save this yet. Please try again.");}
  }
  const gate=demo?<div className="success"><ShieldAlert/><h2>Sample mode</h2><p>Requests can be added once this deployment is connected to a database.</p></div>:null;
  function saveDraftAndResume(){
    try{
      sessionStorage.setItem("civichands-report-resume","1");
      sessionStorage.setItem("civichands-report-category",category);
      if(pin)sessionStorage.setItem("civichands-report-pin",JSON.stringify(pin));
      else sessionStorage.removeItem("civichands-report-pin");
    }catch{
      // Authentication still proceeds if browser storage is unavailable.
    }
  }
  const privateGate=privateRequest&&!signedIn?<section className="notice"><strong>Private neighbor help needs an account</strong><p>Sign in first so you can review replies and choose who receives your exact location. We’ll keep your selected category and map location so you can continue after signing in.</p><div className="button-row"><Link className="primary-button" href="/signin?next=/%23explore" onClick={saveDraftAndResume}>Sign in</Link><Link className="secondary-button" href="/signup?next=/%23explore" onClick={saveDraftAndResume}>Create account</Link></div></section>:null;
  const kind=selectedCategory.kind;
  const safetyNotice=kind==="city_hazard"?<div className="safety-note"><ShieldAlert/><span>For immediate danger, call 911 or the responsible utility. CivicHands reports do not dispatch emergency crews. Stay clear of traffic, downed wires, gas leaks, floodwater, and unstable structures.</span></div>:null;
  const serviceGate=externalReferral?<section className="notice"><strong>Use a professional roadside provider</strong><p>CivicHands does not dispatch tow trucks. Contact your roadside-assistance provider and confirm the company, operator, and truck permit fit the service you need. If the vehicle is in immediate danger in traffic, call <a href="tel:911">911</a>. Review <a href="https://www.tdlr.texas.gov/towing/" target="_blank" rel="noreferrer">Texas TDLR towing licenses and consumer information</a>.</p></section>:null;
  const petNotice=petReport?<div className="notice"><strong>{category==="lost_pet"?"Lost pet":"Found pet"} safety</strong><p>Share a general description and approximate area only. Keep one identifying detail and exact holding location private. Do not post phone numbers, home addresses, or chip numbers. Do not approach an aggressive, injured, or wild animal; contact animal control or a veterinarian.</p></div>:null;
  return <div className="sheet-backdrop" onMouseDown={close}><aside className="report-sheet" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="report-title"><button type="button" className="sheet-close" onClick={close} aria-label="Close"><X/></button>{gate??(state==="saved"?<div className="success"><CheckCircle2/><h2>Submitted for review</h2><p>A moderator will review your request before it appears to the community.</p></div>:<form onSubmit={submit}><div className="sheet-step">Step {step} of 2</div><h2 id="report-title">{step===1?"Where is the need?":"What kind of help is needed?"}</h2><section className="notice"><strong>Need a tow or urgent help for a person?</strong><p>CivicHands does not dispatch tow trucks or emergency responders. For a tow, contact your roadside-assistance provider or review <a href="https://www.tdlr.texas.gov/towing/" target="_blank" rel="noreferrer">Texas TDLR towing information</a>. If a person is in immediate danger, call <a href="tel:911">911</a>. Otherwise contact law enforcement promptly; see the <a href="https://www.dps.texas.gov/section/homeland-security/missing-persons-clearinghouse-mpch" target="_blank" rel="noreferrer">Texas DPS Missing Persons Clearinghouse</a>. Do not post names, photos, sightings, or addresses here.</p></section>
  {step===1?<><p className="sheet-help">A map pin is optional. Use your device location, tap the map, or continue and describe an address, business, intersection, or parking-lot landmark.</p><div className="location-tools"><button type="button" className="secondary-button" onClick={()=>void useDeviceLocation()} disabled={locationBusy}><Crosshair size={16}/>{locationBusy?"Locating…":"Use my device location"}</button>{pin?<button type="button" className="secondary-button" onClick={()=>setPin(null)}>Clear map pin</button>:<span className="muted">No pin selected</span>}</div>{pin&&<div className="coordinate-card"><MapPin/><div><strong>Map location selected</strong><span>{pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}</span></div></div>}{locationError&&<p className="form-error" role="status">{locationError}</p>}<p className="sheet-help">If location permission is denied or the map is not precise enough, continue without a pin. To place one manually, close this panel and tap the map; the form will reopen at that point.</p><div className="sheet-actions"><button type="button" className="secondary-button" onClick={close}>Pick a point on the map</button><button type="button" className="primary-button" onClick={()=>setStep(2)}>Continue</button></div></>:<>
  <input type="hidden" name="latitude" value={pin?.latitude??""}/><input type="hidden" name="longitude" value={pin?.longitude??""}/><input type="hidden" name="kind" value={kind}/><input type="hidden" name="requestType" value={jumpStart?"jump_start":"general"}/>
  <label>What best describes it?<select name="category" required value={category} onChange={e=>setCategory(e.target.value)}><optgroup label="Neighbors helping neighbors">{REPORT_CATEGORIES.filter(item=>item.kind==="neighbor_help").map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</optgroup><optgroup label="Community volunteers">{REPORT_CATEGORIES.filter(item=>item.kind==="public_cleanup").map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</optgroup><optgroup label="City or trained crews">{REPORT_CATEGORIES.filter(item=>item.kind==="city_hazard").map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</optgroup><optgroup label="Professional services">{REPORT_CATEGORIES.filter(item=>item.kind==="external_referral").map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</optgroup></select></label>
  {privateGate??serviceGate??<>{petNotice}{jumpStart?<><p className="sheet-help">Jump-start matching is only for vehicles safely parked away from moving traffic, with a standard 12V system and no visible hazards. If any condition is uncertain, contact roadside assistance. You can submit a general report without a map pin.</p><label>Vehicle type<select name="vehicleType" required><option value="">Choose one</option><option value="passenger_car">Passenger car</option><option value="light_truck">Light truck</option></select></label><fieldset className="equipment-options"><legend>What equipment can help?</legend><label className="checkbox"><input type="checkbox" name="needsCables"/>Jumper cables</label><label className="checkbox"><input type="checkbox" name="needsJumpPack"/>Portable jump pack</label><small>Choose one or both. A helper with either selected item may offer.</small></fieldset><fieldset className="equipment-options"><legend>Confirm all safety conditions</legend><label className="checkbox"><input type="checkbox" name="safeLocationConfirmed" required/>The vehicle is fully outside moving traffic, in a driveway or parking space.</label><label className="checkbox"><input type="checkbox" name="standard12vConfirmed" required/>This is a standard 12V system, not a hybrid or electric vehicle, and I checked the maker’s jump-start guidance.</label><label className="checkbox"><input type="checkbox" name="hazardFreeConfirmed" required/>There is no smoke, leaking, visible battery damage, fuel odor, or other vehicle hazard.</label></fieldset><label>Vehicle and parking details (private, optional)<textarea name="locationDetails" maxLength={500} placeholder="For example: blue Nissan near the front row of the lot."/></label></>:<><label>Short title (optional)<input name="title" maxLength={100} placeholder={selectedCategory.defaultTitle}/></label><label>Details (optional)<textarea name="description" maxLength={1000} placeholder={petReport?"Describe the pet and when or where it was last seen/found; leave one identifying detail out.":privateRequest?"Explain the task, when help is useful, and any access notes. Avoid health, financial, or sensitive personal information.":"Add size, timing, supplies needed, or safety context."}/></label></>}
  {privateRequest&&<label>General area for nearby helpers (optional)<input name="area" maxLength={160} placeholder="For example: north side of the shopping-center lot"/></label>}<label>{privateRequest?"Exact address or directions (private, optional)":"Nearest street, business, or landmark (optional)"}<input name="location" maxLength={240} placeholder={privateRequest?"Address or parking-lot directions; shared only with the helper you accept":"Intersection, public facility, or landmark; do not enter a private home address"}/></label><label>City or community<input name="city" maxLength={80} defaultValue="Texas City" required/></label>
  {safetyNotice}<div className="safety-note"><ShieldAlert/><span>Do not enter traffic or approach dangerous animals. CivicHands is for neighbor assistance and non-emergency community work, not emergency response.</span></div>{state==="error"&&<p className="form-error" role="status">{error||"We couldn’t save this yet. Please check the details."}</p>}<div className="sheet-actions"><button type="button" className="secondary-button" onClick={()=>setStep(1)}>Back</button><button className="primary-button" disabled={state==="saving"}>{state==="saving"?"Submitting…":"Submit for review"}</button></div></>}</>}</form>)}</aside></div>
}
