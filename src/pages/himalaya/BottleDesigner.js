import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ColorLensRoundedIcon from '@mui/icons-material/ColorLensRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SellRoundedIcon from '@mui/icons-material/SellRounded';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import { useSettings } from '../../context/SettingsContext';
import { DEFAULT_SETTINGS } from '../../data/constants';
import './BottleDesigner.css';

const bottleOptions = [
  {
    value: 'Gallon',
    label: '19L returnable bottle',
    description: 'Large-format home and office delivery bottle',
    size: '19L',
  },
  {
    value: 'Large Bottle',
    label: '1.5L retail bottle',
    description: 'Compact grab-and-go product format',
    size: '1.5L',
  },
];

const bottleTones = [
  { id: 'ice', name: 'Ice blue', color: '#9fd9ff' },
  { id: 'aqua', name: 'Aqua', color: '#52d4df' },
  { id: 'cobalt', name: 'Cobalt', color: '#2868d8' },
  { id: 'clear', name: 'Crystal', color: '#e8f7ff' },
  { id: 'smoke', name: 'Smoke', color: '#7f92a3' },
];

const capColors = [
  { id: '#0767d8', name: 'Royal blue' },
  { id: '#078ead', name: 'Glacier' },
  { id: '#0b1528', name: 'Midnight' },
  { id: '#ffffff', name: 'White' },
  { id: '#ef6a43', name: 'Coral' },
];

const labelColors = [
  { id: '#063b52', name: 'Deep ocean' },
  { id: '#078ead', name: 'Glacier' },
  { id: '#14532d', name: 'Evergreen' },
  { id: '#312e81', name: 'Indigo' },
  { id: '#f4f1e8', name: 'Ivory' },
  { id: '#111827', name: 'Onyx' },
];

const textColors = [
  { id: '#ffffff', name: 'White' },
  { id: '#dff8ff', name: 'Ice' },
  { id: '#102a3d', name: 'Navy' },
  { id: '#f8df87', name: 'Gold' },
];

const steps = [
  { id: 'model', label: 'Model', icon: ViewInArRoundedIcon },
  { id: 'bottle', label: 'Bottle', icon: ColorLensRoundedIcon },
  { id: 'label', label: 'Label', icon: SellRoundedIcon },
  { id: 'personalize', label: 'Personalize', icon: TextFieldsRoundedIcon },
];

function normalizedBranding(value) {
  return {
    Gallon: {
      ...DEFAULT_SETTINGS.bottleBranding.Gallon,
      ...((value && value.Gallon) || {}),
    },
    'Large Bottle': {
      ...DEFAULT_SETTINGS.bottleBranding['Large Bottle'],
      ...((value && value['Large Bottle']) || {}),
    },
  };
}

function SwatchSelector({
  label, options, value, onChange,
}) {
  return (
    <fieldset className="bottle-swatch-field">
      <legend>{label}</legend>
      <div className="bottle-swatch-list" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${label}: ${option.name}`}
              className={`bottle-swatch${selected ? ' is-selected' : ''}`}
              onClick={() => onChange(option.id)}
            >
              <i style={{ backgroundColor: option.color || option.id }} aria-hidden="true" />
              <span>{option.name}</span>
              {selected && <CheckRoundedIcon aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ChoiceGrid({
  label, options, value, onChange,
}) {
  return (
    <fieldset className="bottle-choice-field">
      <legend>{label}</legend>
      <div className="bottle-choice-grid" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            className={value === option.id ? 'is-selected' : ''}
            onClick={() => onChange(option.id)}
          >
            <strong>{option.name}</strong>
            {option.description && <small>{option.description}</small>}
            <CheckRoundedIcon aria-hidden="true" />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function BottleDesigner() {
  const { settings, updateSettings } = useSettings();
  const [selected, setSelected] = React.useState('Gallon');
  const [activeStep, setActiveStep] = React.useState('model');
  const [zoomed, setZoomed] = React.useState(false);
  const [branding, setBranding] = React.useState(() => normalizedBranding(settings.bottleBranding));
  const design = branding[selected];
  const bottleMeta = bottleOptions.find((item) => item.value === selected) || bottleOptions[0];

  React.useEffect(() => {
    setBranding(normalizedBranding(settings.bottleBranding));
  }, [settings.bottleBranding]);

  const updateDesign = (field, value) => {
    setBranding((current) => ({
      ...current,
      [selected]: { ...current[selected], [field]: value },
    }));
  };

  const selectTone = (toneId) => {
    const tone = bottleTones.find((item) => item.id === toneId) || bottleTones[0];
    setBranding((current) => ({
      ...current,
      [selected]: {
        ...current[selected],
        bottleTone: tone.id,
        bottleColor: tone.color,
      },
    }));
  };

  const save = () => {
    updateSettings({ bottleBranding: branding });
    toast.success('Bottle designs saved.');
  };

  const resetSelected = () => {
    setBranding((current) => ({
      ...current,
      [selected]: { ...DEFAULT_SETTINGS.bottleBranding[selected] },
    }));
    toast.info(`${bottleMeta.label} reset to its original design.`);
  };

  return (
    <PageShell
      title="Bottle customizer"
      subtitle="Build a production-ready bottle concept one component at a time"
      actions={(
        <>
          <Button variant="outlined" startIcon={<RestartAltRoundedIcon />} onClick={resetSelected}>
            Reset
          </Button>
          <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={save}>
            Save design
          </Button>
        </>
      )}
    >
      <Grid container spacing={2.5} className="bottle-designer">
        <Grid item xs={12} lg={8}>
          <Card className="bottle-preview-card">
            <CardContent>
              <div className="bottle-preview-toolbar">
                <div>
                  <Typography variant="overline" color="primary.main">Live product view</Typography>
                  <Typography variant="h5">{bottleMeta.label}</Typography>
                </div>
                <Stack direction="row" spacing={1} alignItems="center">
              <span className="bottle-preview-status"><i />Live preview</span>
                  <Tooltip title={zoomed ? 'Fit product to view' : 'Zoom product'}>
                    <IconButton
                      aria-label={zoomed ? 'Fit bottle to view' : 'Zoom bottle preview'}
                      aria-pressed={zoomed}
                      onClick={() => setZoomed((current) => !current)}
                    >
                      <ZoomInRoundedIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </div>

              <div
                className={`bottle-product-stage is-${design.finish || 'gloss'}${zoomed ? ' is-zoomed' : ''}`}
                data-tone={design.bottleTone || 'ice'}
              >
                <span className="bottle-view-label">Front view</span>
                {selected === 'Gallon' ? (
                  <div className="bottle-photo-product">
                    <img
                      src={`${process.env.PUBLIC_URL || ''}/bottle-19l-customizer.png`}
                      alt="19 litre returnable water bottle preview"
                      width="500"
                      height="500"
                    />
                    <span className="bottle-photo-cap" style={{ '--bottle-cap': design.capColor }} />
                    <span
                      className={`bottle-live-label is-${design.labelShape || 'rounded'}`}
                      style={{
                        '--preview-label': design.labelColor,
                        '--preview-label-text': design.textColor,
                        '--preview-label-scale': `${design.labelScale / 100}`,
                      }}
                    >
                      <WaterDropRoundedIcon />
                      <strong>{design.label || 'Himaliya Spring'}</strong>
                      <small>{design.subtitle || bottleMeta.size}</small>
                      <i>{bottleMeta.size}</i>
                    </span>
                  </div>
                ) : (
                  <div
                    className="bottle-small-product"
                    style={{
                      '--preview-bottle': design.bottleColor,
                      '--bottle-cap': design.capColor,
                    }}
                  >
                    <span className="bottle-small-cap" />
                    <span
                      className={`bottle-live-label is-${design.labelShape || 'rounded'}`}
                      style={{
                        '--preview-label': design.labelColor,
                        '--preview-label-text': design.textColor,
                        '--preview-label-scale': `${design.labelScale / 100}`,
                      }}
                    >
                      <WaterDropRoundedIcon />
                      <strong>{design.label || 'Himaliya Spring'}</strong>
                      <small>{design.subtitle || bottleMeta.size}</small>
                      <i>{bottleMeta.size}</i>
                    </span>
                  </div>
                )}

                <div className="bottle-design-summary" aria-label="Current bottle configuration">
                  <span><small>Model</small><strong>{bottleMeta.size}</strong></span>
                  <span><small>Finish</small><strong>{design.finish || 'Gloss'}</strong></span>
                  <span><small>Label</small><strong>{design.labelShape || 'Rounded'}</strong></span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card className="bottle-designer-controls">
            <div className="bottle-configurator-heading">
              <Box className="bottle-designer-icon"><WaterDropRoundedIcon /></Box>
              <div>
                <Typography variant="h5">Customize your bottle</Typography>
                <Typography variant="body2" color="text.secondary">
                  Select a step and compare options instantly.
                </Typography>
              </div>
            </div>

            <nav className="bottle-configurator-steps" aria-label="Bottle customization steps">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <button
                    key={step.id}
                    type="button"
                    className={activeStep === step.id ? 'is-active' : ''}
                    aria-current={activeStep === step.id ? 'step' : undefined}
                    onClick={() => setActiveStep(step.id)}
                  >
                    <span>{index + 1}</span>
                    <Icon />
                    <small>{step.label}</small>
                  </button>
                );
              })}
            </nav>

            <CardContent className="bottle-configurator-panel">
              {activeStep === 'model' && (
                <ChoiceGrid
                  label="Bottle model"
                  value={selected}
                  onChange={(value) => setSelected(value)}
                  options={bottleOptions.map((option) => ({
                    id: option.value,
                    name: option.label,
                    description: option.description,
                  }))}
                />
              )}

              {activeStep === 'bottle' && (
                <Stack spacing={2.5}>
                  <SwatchSelector
                    label="Bottle tone"
                    options={bottleTones}
                    value={design.bottleTone || 'ice'}
                    onChange={selectTone}
                  />
                  <SwatchSelector
                    label="Cap color"
                    options={capColors}
                    value={design.capColor || '#0767d8'}
                    onChange={(value) => updateDesign('capColor', value)}
                  />
                  <ChoiceGrid
                    label="Surface finish"
                    value={design.finish || 'gloss'}
                    onChange={(value) => updateDesign('finish', value)}
                    options={[
                      { id: 'gloss', name: 'Gloss', description: 'Bright and polished' },
                      { id: 'frosted', name: 'Frosted', description: 'Soft translucent surface' },
                      { id: 'matte', name: 'Matte', description: 'Low-reflection finish' },
                    ]}
                  />
                </Stack>
              )}

              {activeStep === 'label' && (
                <Stack spacing={2.5}>
                  <ChoiceGrid
                    label="Label shape"
                    value={design.labelShape || 'rounded'}
                    onChange={(value) => updateDesign('labelShape', value)}
                    options={[
                      { id: 'rounded', name: 'Rounded', description: 'Friendly retail label' },
                      { id: 'badge', name: 'Badge', description: 'Premium centered mark' },
                      { id: 'band', name: 'Band', description: 'Wide modern wrap' },
                    ]}
                  />
                  <SwatchSelector
                    label="Label color"
                    options={labelColors}
                    value={design.labelColor}
                    onChange={(value) => updateDesign('labelColor', value)}
                  />
                  <Box>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" fontWeight={800}>Label size</Typography>
                      <Typography variant="caption" color="text.secondary">{design.labelScale}%</Typography>
                    </Stack>
                    <Slider
                      value={Number(design.labelScale) || 100}
                      onChange={(event, value) => updateDesign('labelScale', value)}
                      min={72}
                      max={118}
                      step={1}
                      valueLabelDisplay="auto"
                      aria-label="Bottle label size"
                    />
                  </Box>
                </Stack>
              )}

              {activeStep === 'personalize' && (
                <Stack spacing={2.25}>
                  <TextField
                    label="Brand name"
                    value={design.label}
                    onChange={(event) => updateDesign('label', event.target.value)}
                    placeholder="Himaliya Spring"
                    inputProps={{ maxLength: 34 }}
                    helperText={`${(design.label || '').length}/34 characters`}
                    fullWidth
                  />
                  <TextField
                    label="Product line"
                    value={design.subtitle}
                    onChange={(event) => updateDesign('subtitle', event.target.value)}
                    placeholder={`Pure drinking water · ${bottleMeta.size}`}
                    inputProps={{ maxLength: 48 }}
                    helperText={`${(design.subtitle || '').length}/48 characters`}
                    fullWidth
                  />
                  <SwatchSelector
                    label="Typography color"
                    options={textColors}
                    value={design.textColor}
                    onChange={(value) => updateDesign('textColor', value)}
                  />
                </Stack>
              )}

              <div className="bottle-step-footer">
                <span>Step {steps.findIndex((step) => step.id === activeStep) + 1} of {steps.length}</span>
                {activeStep !== 'personalize' && (
                  <Button
                    variant="contained"
                    onClick={() => {
                      const index = steps.findIndex((step) => step.id === activeStep);
                      setActiveStep(steps[Math.min(index + 1, steps.length - 1)].id);
                    }}
                  >
                    Next step
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </PageShell>
  );
}
