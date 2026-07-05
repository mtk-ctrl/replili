using UnityEngine;

namespace CaptureTheFlag
{
    [RequireComponent(typeof(CharacterController))]
    public class ThirdPersonController : MonoBehaviour
    {
        public float moveSpeed = 5f;
        public float runSpeed = 8f;
        public float jumpHeight = 1.2f;
        public float gravity = -18f;
        public float rotationSpeed = 12f;
        public Transform cameraTransform;

        private CharacterController controller;
        private Vector3 velocity;

        private void Awake()
        {
            controller = GetComponent<CharacterController>();
            if (cameraTransform == null && Camera.main != null)
            {
                cameraTransform = Camera.main.transform;
            }
        }

        private void Update()
        {
            var input = new Vector3(Input.GetAxisRaw("Horizontal"), 0f, Input.GetAxisRaw("Vertical"));
            input = Vector3.ClampMagnitude(input, 1f);

            var moveDirection = Vector3.zero;
            if (input.sqrMagnitude > 0.0001f && cameraTransform != null)
            {
                var camForward = Vector3.ProjectOnPlane(cameraTransform.forward, Vector3.up).normalized;
                var camRight = Vector3.ProjectOnPlane(cameraTransform.right, Vector3.up).normalized;
                moveDirection = camForward * input.z + camRight * input.x;

                var targetRotation = Quaternion.LookRotation(moveDirection, Vector3.up);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, rotationSpeed * Time.deltaTime);
            }

            var speed = Input.GetKey(KeyCode.LeftShift) ? runSpeed : moveSpeed;
            var horizontalMove = moveDirection * speed;

            if (controller.isGrounded)
            {
                velocity.y = -1f;
                if (Input.GetButtonDown("Jump"))
                {
                    velocity.y = Mathf.Sqrt(jumpHeight * -2f * gravity);
                }
            }
            velocity.y += gravity * Time.deltaTime;

            var motion = (horizontalMove + Vector3.up * velocity.y) * Time.deltaTime;
            controller.Move(motion);
        }
    }
}
