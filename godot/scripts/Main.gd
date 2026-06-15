extends Node3D
## Builds the vertical-slice world in code: HDRI sky + image-based light, a sun,
## a PBR-grass ground with a collider, the Ferris wheel, and the player.

const GRASS := "res://assets/textures/grass/"
const HDRI := "res://assets/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr"

func _ready() -> void:
	_build_environment()
	_build_sun()
	_build_ground()

	var ferris := preload("res://scripts/FerrisWheel.gd").new()
	ferris.position = Vector3(-12, 0, -10)
	add_child(ferris)

	var player := preload("res://scripts/Player.gd").new()
	player.position = Vector3(0, 1.0, 6)
	add_child(player)

func _build_environment() -> void:
	var env := Environment.new()
	var sky := Sky.new()
	var sky_mat := PanoramaSkyMaterial.new()
	var hdr := load(HDRI)
	if hdr:
		sky_mat.panorama = hdr
	sky.sky_material = sky_mat
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 1.0
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

func _build_sun() -> void:
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-50.0), deg_to_rad(40.0), 0.0)
	sun.light_energy = 1.4
	sun.shadow_enabled = true
	add_child(sun)

func _build_ground() -> void:
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(140, 140)
	ground.mesh = plane
	var gm := StandardMaterial3D.new()
	gm.albedo_texture = load(GRASS + "Grass004_1K-JPG_Color.jpg")
	gm.normal_enabled = true
	gm.normal_texture = load(GRASS + "Grass004_1K-JPG_NormalGL.jpg")
	gm.roughness_texture = load(GRASS + "Grass004_1K-JPG_Roughness.jpg")
	gm.uv1_scale = Vector3(40, 40, 1)
	ground.material_override = gm
	add_child(ground)

	var body := StaticBody3D.new()
	var col := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(140, 0.2, 140)
	col.shape = box
	col.position = Vector3(0, -0.1, 0)
	body.add_child(col)
	add_child(body)
