extends Node3D
## A continuously-spinning Ferris wheel with 8 gondolas that counter-rotate to
## stay upright — the Godot port of the browser ride's core behaviour. Built
## entirely in code (procedural meshes) so it needs no editor scene authoring.

const RADIUS := 6.0
const HUB_Y := 8.0
const SPIN := 0.25 # radians / second

var _wheel: Node3D
var _gondolas: Array[Node3D] = []

func _ready() -> void:
	_build_legs()
	_build_wheel()

func _process(delta: float) -> void:
	# Spin the wheel about its Z axis; counter-rotate each gondola so riders stay level.
	_wheel.rotation.z += SPIN * delta
	for g in _gondolas:
		g.rotation.z = -_wheel.rotation.z

func _mat(c: Color, metallic := 0.0, rough := 0.5) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.metallic = metallic
	m.roughness = rough
	return m

func _build_legs() -> void:
	var leg_mat := _mat(Color(0.10, 0.13, 0.22), 0.2, 0.5)
	for sx in [-2.6, 2.6]:
		var leg := MeshInstance3D.new()
		var lm := CylinderMesh.new()
		lm.top_radius = 0.16
		lm.bottom_radius = 0.34
		lm.height = HUB_Y + 1.0
		leg.mesh = lm
		leg.material_override = leg_mat
		leg.position = Vector3(sx, (HUB_Y + 1.0) / 2.0, 0.0)
		leg.rotation.z = -sign(sx) * 0.2
		add_child(leg)

func _build_wheel() -> void:
	_wheel = Node3D.new()
	_wheel.position = Vector3(0, HUB_Y, 0)
	add_child(_wheel)

	# hub
	var hub := MeshInstance3D.new()
	var hm := CylinderMesh.new()
	hm.top_radius = 0.5
	hm.bottom_radius = 0.5
	hm.height = 1.2
	hub.mesh = hm
	hub.rotation.x = PI / 2.0 # lay the drum along Z
	hub.material_override = _mat(Color(0.10, 0.13, 0.22), 0.6, 0.3)
	_wheel.add_child(hub)

	var spoke_mat := _mat(Color(0.95, 0.93, 0.85), 0.2, 0.4)
	var seat_mats := [_mat(Color(0.78, 0.06, 0.18), 0.0, 0.45), _mat(Color(1.0, 0.95, 0.86), 0.0, 0.5)]

	for i in 8:
		var a := float(i) / 8.0 * TAU
		var rx := cos(a) * RADIUS
		var ry := sin(a) * RADIUS

		# spoke from hub to rim
		var spoke := MeshInstance3D.new()
		var sm := CylinderMesh.new()
		sm.top_radius = 0.05
		sm.bottom_radius = 0.05
		sm.height = RADIUS
		spoke.mesh = sm
		spoke.material_override = spoke_mat
		spoke.position = Vector3(rx / 2.0, ry / 2.0, 0.0)
		spoke.rotation.z = a - PI / 2.0
		_wheel.add_child(spoke)

		# gondola pivot at the rim (counter-rotated each frame)
		var g := Node3D.new()
		g.position = Vector3(rx, ry, 0.0)
		_wheel.add_child(g)
		_gondolas.append(g)

		var cabin := MeshInstance3D.new()
		var cb := BoxMesh.new()
		cb.size = Vector3(1.2, 1.0, 1.2)
		cabin.mesh = cb
		cabin.material_override = seat_mats[i % 2]
		cabin.position = Vector3(0, -0.75, 0) # hangs below the rim point
		g.add_child(cabin)
