'use client'

import { Physics } from '@react-three/rapier'
import { Environment } from '@react-three/drei'
import GameSystems from '@/components/GameSystems'
import PhotoCamera from '@/components/PhotoCamera'
import FestivalController from '@/components/festival/FestivalController'
import Player from '@/components/Player/Player'
import Ground from '@/components/world/Ground'
import SkyDome from '@/components/world/SkyDome'
import Lighting from '@/components/world/Lighting'
import Pathways from '@/components/world/Pathways'
import Fence from '@/components/world/Fence'
import Trees from '@/components/world/Trees'
import Lamps from '@/components/world/Lamps'
import Crowd from '@/components/world/Crowd'
import SpeechBubbles from '@/components/world/SpeechBubbles'
import Fountain from '@/components/world/Fountain'
import CircusTent from '@/components/world/CircusTent'
import Bunting from '@/components/world/Bunting'
import StringLights from '@/components/world/StringLights'
import Balloons from '@/components/world/Balloons'
import GameStalls from '@/components/world/GameStalls'
import VendorCarts from '@/components/world/VendorCarts'
import AutoRickshaw from '@/components/world/AutoRickshaw'
import FloodLights from '@/components/world/FloodLights'
import FairCrowd from '@/components/world/FairCrowd'
import EntranceGate from '@/components/structures/EntranceGate'
import TicketBooth from '@/components/structures/TicketBooth'
import FoodStall from '@/components/structures/FoodStall'
import BalloonStall from '@/components/structures/BalloonStall'
import Restroom from '@/components/structures/Restroom'
import BalloonFollow from '@/components/world/BalloonFollow'
import FerrisWheel from '@/components/rides/FerrisWheel'
import RollerCoaster from '@/components/rides/RollerCoaster'
import Carousel from '@/components/rides/Carousel'
import TeacupSpinner from '@/components/rides/TeacupSpinner'
import DropTower from '@/components/rides/DropTower'
import BumperCars from '@/components/rides/BumperCars'
import Columbus from '@/components/rides/Columbus'
import ShootingGallery from '@/components/stalls/ShootingGallery'
import RingToss from '@/components/stalls/RingToss'
import { STALLS } from '@/lib/spawn'

export default function Scene() {
  return (
    <>
      <SkyDome />
      <Lighting />
      <Environment files="/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr" background={false} />
      <GameSystems />
      <PhotoCamera />
      <FestivalController />
      <Physics gravity={[0, -9.81, 0]}>
        <Ground />
        <Pathways />
        <Fence />
        <Fountain />
        <Trees />
        <Lamps />
        <Crowd />
        <SpeechBubbles />
        <CircusTent />
        <Bunting />
        <StringLights />
        <Balloons />
        <GameStalls />
        <VendorCarts />
        <AutoRickshaw />
        <FloodLights />
        <FairCrowd />

        <EntranceGate />
        <TicketBooth />
        {STALLS.map((s) => (
          <FoodStall key={s.id} {...s} />
        ))}
        <BalloonStall />
        <Restroom />
        <BalloonFollow />

        <FerrisWheel />
        <RollerCoaster />
        <Carousel />
        <TeacupSpinner />
        <DropTower />
        <BumperCars />
        <Columbus />
        <ShootingGallery />
        <RingToss />

        <Player />
      </Physics>
    </>
  )
}
