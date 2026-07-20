import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import s from './Widget.module.scss';

export default function Widget({
  title,
  className,
  children,
  close,
  fullscreen,
  collapse,
  refresh,
  bodyClass,
  fetchingData,
  collapsed,
  prompt,
  widgetType,
  updateWidgetData,
  ...attributes
}) {
  const [hidden, setHidden] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(Boolean(collapsed));
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [reloading, setReloading] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const reloadTimer = React.useRef(null);

  React.useEffect(() => () => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
  }, []);

  const handleReload = () => {
    if (typeof updateWidgetData === 'function') updateWidgetData(widgetType);
    setReloading(true);
    reloadTimer.current = window.setTimeout(() => setReloading(false), 650);
  };

  const handleClose = () => {
    if (prompt) setConfirmClose(true);
    else setHidden(true);
  };

  if (hidden) return null;

  const busy = reloading || fetchingData;
  const hasControls = Boolean(close || fullscreen || collapse || refresh);

  return (
    <React.Fragment>
      {isFullscreen && <div className={s.widgetBackdrop} aria-hidden="true" />}
      <section
        className={classNames(
          'widget',
          s.widget,
          className,
          isCollapsed && 'collapsed',
          isFullscreen && s.fullscreened,
          busy && s.reloading
        )}
        aria-busy={busy}
        {...attributes}
      >
        {(title || hasControls) && (
          <header className={s.header}>
            <div className={s.title}>
              {typeof title === 'string' ? <h5>{title}</h5> : title}
            </div>
            {hasControls && (
              <div className={s.widgetControls}>
                {refresh && (
                  <Tooltip title="Refresh">
                    <IconButton size="small" onClick={handleReload} aria-label="Refresh card">
                      <RefreshRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {fullscreen && (
                  <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}>
                    <IconButton
                      size="small"
                      onClick={() => setIsFullscreen((current) => !current)}
                      aria-label={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
                    >
                      {isFullscreen
                        ? <FullscreenExitRoundedIcon fontSize="small" />
                        : <FullscreenRoundedIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                )}
                {collapse && !isFullscreen && (
                  <Tooltip title={isCollapsed ? 'Expand' : 'Collapse'}>
                    <IconButton
                      size="small"
                      onClick={() => setIsCollapsed((current) => !current)}
                      aria-expanded={!isCollapsed}
                      aria-label={isCollapsed ? 'Expand card' : 'Collapse card'}
                    >
                      {isCollapsed
                        ? <ExpandMoreRoundedIcon fontSize="small" />
                        : <ExpandLessRoundedIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                )}
                {close && !isFullscreen && (
                  <Tooltip title="Hide">
                    <IconButton size="small" onClick={handleClose} aria-label="Hide card">
                      <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            )}
          </header>
        )}

        <Collapse in={!isCollapsed} timeout={220} unmountOnExit={false}>
          <div className={classNames(s.widgetBody, 'widget-body', bodyClass)}>
            {busy && (
              <div className={s.loadingOverlay}>
                <CircularProgress size={28} thickness={4} />
                <span>Refreshing data</span>
              </div>
            )}
            {children}
          </div>
        </Collapse>
      </section>

      <Dialog open={confirmClose} onClose={() => setConfirmClose(false)} aria-labelledby="widget-close-title">
        <DialogTitle id="widget-close-title">Hide this card?</DialogTitle>
        <DialogContent>
          <DialogContentText>You can restore it by refreshing the page.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClose(false)} color="inherit">Cancel</Button>
          <Button onClick={() => { setConfirmClose(false); setHidden(true); }} color="error">Hide card</Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}

Widget.propTypes = {
  title: PropTypes.node,
  className: PropTypes.string,
  children: PropTypes.node,
  close: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  fullscreen: PropTypes.bool,
  collapse: PropTypes.bool,
  refresh: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  bodyClass: PropTypes.string,
  fetchingData: PropTypes.bool,
  collapsed: PropTypes.bool,
  prompt: PropTypes.bool,
  widgetType: PropTypes.string,
  updateWidgetData: PropTypes.func,
};

Widget.defaultProps = {
  title: null,
  className: '',
  children: null,
  close: false,
  fullscreen: false,
  collapse: false,
  refresh: false,
  bodyClass: '',
  fetchingData: false,
  collapsed: false,
  prompt: false,
  widgetType: '',
  updateWidgetData: null,
};
