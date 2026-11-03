import React, { useState } from 'react';
import { Alert, Image, Linking, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import NativeCamera from './modules/ultracam-camera';
import { pairingForTransport, Transport } from './src/pairing';
import { ActionButton, useReducedMotion } from './src/components/ActionButton';
export default function App() {
 useKeepAwake();
 const reduceMotion = useReducedMotion();
 const [permission, requestPermission] = useCameraPermissions();
 const [address,setAddress] = useState(''); const [url,setUrl] = useState('');
 const [scan,setScan] = useState(false); const [facing,setFacing] = useState('back');
 const [torch,setTorch] = useState(false); const [zoom,setZoom] = useState(0);
 const [fps,setFps] = useState(15); const [quality,setQuality] = useState(75);
 const [transport,setTransport] = useState<Transport>('wifi');
 const [streaming,setStreaming] = useState(false);
 const [status,setStatus] = useState('Prêt à connecter'); const [frames,setFrames] = useState(0);
 const connect = (value:string) => {
  try { const endpoint = pairingForTransport(value, transport);
   setAddress(endpoint);setUrl(endpoint);setScan(false);setStreaming(false);setStatus('Connexion…');setFrames(0);
   if (Platform.OS === 'android' && endpoint.startsWith('ws://127.0.0.1:')) setTransport('usb');
  } catch { Alert.alert('Adresse invalide','Scannez le QR code affiché dans Ultracam Studio ou collez son adresse de connexion complète.'); }
 };
 const button = (title:string,action:()=>void,active=false,disabled=false) => <ActionButton key={title} title={title} reduceMotion={reduceMotion} onPress={action} selected={active} disabled={disabled}/>;
 const disconnect = () => { setUrl('');setFrames(0);setStreaming(false);setStatus('Déconnecté'); };
 const chooseTransport = (next:Transport) => { disconnect();setScan(false);setTransport(next);setAddress(''); };
 if (!permission?.granted) return <SafeAreaView style={s.page}><View style={s.center}><Image source={require('./Ultracam-Mobile-logo.png')} style={s.logo}/><Text style={s.title}>Votre caméra. Sans limites d’abonnement.</Text><Text style={s.help}>Autorisez la caméra pour relier ce téléphone à Ultracam Studio Pro.</Text>{button('Autoriser la caméra',()=>{void requestPermission();},true)}{permission&&!permission.canAskAgain&&<View><Text style={s.help}>Activez la permission caméra dans les réglages du téléphone.</Text>{button('Ouvrir les réglages',()=>{void Linking.openSettings();})}</View>}</View></SafeAreaView>;
 return <SafeAreaView style={s.page}><StatusBar style="light"/><View style={s.header}><Image source={require('./Ultracam-Mobile-logo.png')} style={s.smallLogo}/><View><Text style={s.brand}>ULTRACAM</Text><Text style={s.subtitle}>REMOTE MOBILE</Text></View><View style={s.badge}><Text style={s.badgeText}>PRO</Text></View></View>
  <View style={s.preview}>
   {scan ? <CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={({data})=>connect(data)}/> : <NativeCamera style={StyleSheet.absoluteFill} url={url} facing={facing} torch={torch} zoom={zoom} fps={fps} quality={quality} onControls={({nativeEvent:e})=>{if(e.facing!==undefined)setFacing(e.facing);if(e.torch!==undefined)setTorch(e.torch);if(e.zoom!==undefined)setZoom(e.zoom);if(e.fps!==undefined)setFps(e.fps);}} onStatus={({nativeEvent:e})=>{setStatus(e.message);setStreaming(e.state==='streaming');if(e.frames!==undefined)setFrames(e.frames);if(e.state==='error'||e.state==='closed'){setUrl('');setFrames(0);}}}/>}
   <View style={s.status}><View style={[s.dot,{backgroundColor:streaming?'#52e0b0':'#f9bc62'}]}/><Text style={s.statusText}>{status}</Text></View>
   <View style={s.previewBottom}><Text style={s.chip}>{scan?'SCANNEZ LE QR DU STUDIO':`${fps} FPS CIBLES · JPEG ${quality}%`}</Text><Text style={s.chip}>{frames} images envoyées</Text></View>
  </View>
  <ScrollView style={s.controls} contentContainerStyle={{paddingBottom:30}}>
   <Text style={s.section}>CONNEXION AU STUDIO</Text>{Platform.OS==='android'&&<View style={s.row}>{button('Wi-Fi',()=>chooseTransport('wifi'),transport==='wifi')}{button('USB',()=>chooseTransport('usb'),transport==='usb')}</View>}<TextInput style={s.input} value={address} onChangeText={setAddress} autoCapitalize="none" autoCorrect={false} placeholder="Adresse de connexion affichée sur le PC" placeholderTextColor="#778293" accessibilityLabel="Adresse du studio"/>
   <View style={s.row}>{button(scan?'Fermer le scan':'Scanner le QR',()=>{disconnect();setScan(!scan);})}{button(url?'Déconnecter':'Connecter',()=>url?disconnect():connect(address),!!url)}</View>
   <Text style={s.help}>{transport==='usb'?'Branchez le câble, autorisez le débogage USB et cliquez sur « Connecter en USB » dans le Studio, puis scannez son QR.':'Téléphone et PC sur le même réseau privé. Scannez le QR du Studio.'} Le code de connexion doit rester privé.</Text>
   <Text style={s.section}>CAMÉRA</Text><View style={s.row}>{button('Arrière',()=>setFacing('back'),facing==='back')}{button('Avant',()=>{setFacing('front');setTorch(false);},facing==='front')}{button('Torche',()=>setTorch(!torch),torch,facing==='front')}</View>
   <Text style={s.section}>ZOOM</Text><View style={s.row}>{[0,.25,.5,.75].map((z)=>button(`${Math.round(z*100)} %`,()=>setZoom(z),zoom===z))}</View>
   <Text style={s.section}>FLUIDITÉ CIBLE</Text><View style={s.row}>{[10,15,24,30].map((n)=>button(`${n} fps`,()=>setFps(n),fps===n))}</View>
   <Text style={s.section}>QUALITÉ JPEG</Text><View style={s.row}>{[55,75,90].map((n)=>button(`${n} %`,()=>setQuality(n),quality===n))}</View>
   <Text style={s.help}>La cadence réelle dépend du téléphone et du réseau. Les réglages d’image et l’enregistrement sont disponibles sur le Studio.</Text>
  </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:'#10131a'},center:{flex:1,justifyContent:'center',padding:28,gap:20},logo:{width:100,height:100,alignSelf:'center'},smallLogo:{width:44,height:44},header:{flexDirection:'row',alignItems:'center',gap:12,padding:18},brand:{color:'#f5f7ff',fontSize:20,fontWeight:'800',letterSpacing:2},subtitle:{color:'#9ca8ba',fontSize:10,letterSpacing:3},badge:{marginLeft:'auto',backgroundColor:'#7460e8',paddingHorizontal:12,paddingVertical:6,borderRadius:7},badgeText:{color:'white',fontWeight:'800'},title:{color:'white',fontSize:26,fontWeight:'700'},preview:{height:'40%',minHeight:220,backgroundColor:'#080a10',marginHorizontal:12,borderRadius:18,overflow:'hidden'},status:{position:'absolute',top:12,left:12,right:12,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#10131add',padding:10,borderRadius:8},dot:{width:7,height:7,borderRadius:4},statusText:{color:'white',flex:1,fontSize:12},previewBottom:{position:'absolute',bottom:12,left:12,right:12,flexDirection:'row',justifyContent:'space-between'},chip:{color:'white',fontSize:10,backgroundColor:'#10131abb',padding:6,borderRadius:5},controls:{paddingHorizontal:20},section:{color:'#a4adc0',fontSize:10,letterSpacing:2,fontWeight:'700',marginTop:22,marginBottom:10},row:{flexDirection:'row',gap:8,marginTop:10,flexWrap:'wrap'},input:{backgroundColor:'#1d2330',color:'white',padding:14,borderRadius:10,fontSize:13},help:{color:'#8c98ac',fontSize:12,lineHeight:19,marginTop:10}});
