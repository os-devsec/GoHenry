import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('GoHenryGo esta listo para abrirse sin conexion.');
  },
  onRegisterError(error) {
    console.error('No se pudo registrar la PWA de GoHenryGo.', error);
  },
});
