using UnityEngine;

namespace CaptureTheFlag
{
    public class CaptureFlag : MonoBehaviour
    {
        [SerializeField] private Renderer flagRenderer;

        private static readonly Color NeutralColor = Color.white;
        private static readonly Color TeamAColor = new Color(0.2f, 0.4f, 1f);
        private static readonly Color TeamBColor = new Color(1f, 0.3f, 0.2f);

        public Team Owner { get; private set; } = Team.Neutral;

        private void OnTriggerEnter(Collider other)
        {
            var playerTeam = other.GetComponent<PlayerTeam>();
            if (playerTeam == null || playerTeam.team == Owner) return;
            SetOwner(playerTeam.team);
        }

        private void SetOwner(Team team)
        {
            Owner = team;
            if (flagRenderer == null) return;

            flagRenderer.material.color = team switch
            {
                Team.TeamA => TeamAColor,
                Team.TeamB => TeamBColor,
                _ => NeutralColor,
            };
        }
    }
}
