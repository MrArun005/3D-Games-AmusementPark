extends CharacterBody3D
## First/third-person player: WASD move in the look frame, mouse-look, jump,
## sprint. Built in code; reads physical keys directly (no input map needed).
## Third-person body is the reused civilian GLB, scaled to human height.

const SPEED := 4.5
const SPRINT := 8.0
const JUMP := 5.5
const GRAVITY := 12.0
const MOUSE_SENS := 0.0025
const MODEL_PATH := "res://assets/characters/civilian_man.glb"

var _yaw := 0.0
var _pitch := 0.0
var _pivot: Node3D
var _cam: Camera3D
var _body: Node3D = null
var _third := false

func _ready() -> void:
	# capsule collider (~1.7 m tall, centred at 0.85)
	var col := CollisionShape3D.new()
	var caps := CapsuleShape3D.new()
	caps.radius = 0.35
	caps.height = 1.7
	col.shape = caps
	col.position = Vector3(0, 0.85, 0)
	add_child(col)

	# camera pivot at eye height; pitch lives here, yaw on the body
	_pivot = Node3D.new()
	_pivot.position = Vector3(0, 1.6, 0)
	add_child(_pivot)
	_cam = Camera3D.new()
	_cam.current = true
	_pivot.add_child(_cam)

	# third-person avatar: the civilian GLB (fallback to a capsule mesh)
	var packed := load(MODEL_PATH)
	if packed is PackedScene:
		_body = (packed as PackedScene).instantiate()
		_body.scale = Vector3.ONE * (1.7 / 4.8) # pack renders ~4.8 m tall
		add_child(_body)
		_play_idle(_body)
	else:
		_body = _fallback_body()
		add_child(_body)
	_body.visible = _third

	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _fallback_body() -> Node3D:
	var m := MeshInstance3D.new()
	var cap := CapsuleMesh.new()
	cap.radius = 0.32
	cap.height = 1.7
	m.mesh = cap
	m.position = Vector3(0, 0.85, 0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.2, 0.5, 0.8)
	m.material_override = mat
	return m

func _play_idle(root: Node) -> void:
	var ap := root.find_child("AnimationPlayer", true, false)
	if ap and ap is AnimationPlayer:
		var anim := ap as AnimationPlayer
		for n in anim.get_animation_list():
			if "Idle" in n:
				anim.play(n)
				return
		var names := anim.get_animation_list()
		if names.size() > 0:
			anim.play(names[0])

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var mm := event as InputEventMouseMotion
		_yaw -= mm.relative.x * MOUSE_SENS
		_pitch = clamp(_pitch - mm.relative.y * MOUSE_SENS, -1.4, 1.4)
	elif event is InputEventKey and event.pressed and not event.echo:
		var k := event as InputEventKey
		if k.physical_keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif k.physical_keycode == KEY_V:
			_third = not _third
			_body.visible = _third
		elif k.physical_keycode == KEY_SPACE and is_on_floor():
			velocity.y = JUMP
	elif event is InputEventMouseButton and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _physics_process(delta: float) -> void:
	rotation.y = _yaw
	_pivot.rotation.x = _pitch

	if not is_on_floor():
		velocity.y -= GRAVITY * delta

	var iv := Vector3.ZERO
	if Input.is_physical_key_pressed(KEY_W): iv.z -= 1.0
	if Input.is_physical_key_pressed(KEY_S): iv.z += 1.0
	if Input.is_physical_key_pressed(KEY_A): iv.x -= 1.0
	if Input.is_physical_key_pressed(KEY_D): iv.x += 1.0

	var spd := SPRINT if Input.is_physical_key_pressed(KEY_SHIFT) else SPEED
	var dir := transform.basis * Vector3(iv.x, 0.0, iv.z)
	dir.y = 0.0
	if dir.length() > 0.01:
		dir = dir.normalized()
	velocity.x = dir.x * spd
	velocity.z = dir.z * spd

	move_and_slide()

	# camera: at the eye in first person, pulled back in third
	_cam.position = Vector3(0, 0.4, 4.0) if _third else Vector3.ZERO
