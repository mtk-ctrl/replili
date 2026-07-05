using UnityEngine;

namespace CaptureTheFlag
{
    public class OrbitFollowCamera : MonoBehaviour
    {
        public Transform target;
        public float distance = 5f;
        public float height = 2f;
        public float mouseSensitivity = 3f;
        public float minPitch = -20f;
        public float maxPitch = 60f;

        private float yaw;
        private float pitch = 15f;

        private void Start()
        {
            Cursor.lockState = CursorLockMode.Locked;
        }

        private void LateUpdate()
        {
            if (target == null) return;

            yaw += Input.GetAxis("Mouse X") * mouseSensitivity;
            pitch -= Input.GetAxis("Mouse Y") * mouseSensitivity;
            pitch = Mathf.Clamp(pitch, minPitch, maxPitch);

            var rotation = Quaternion.Euler(pitch, yaw, 0f);
            var focusPoint = target.position + Vector3.up * height;
            var desiredPosition = focusPoint - rotation * Vector3.forward * distance;

            transform.position = desiredPosition;
            transform.LookAt(focusPoint);
        }
    }
}
